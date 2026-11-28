import { useCallback, useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPromptResult = 'accepted' | 'dismissed' | 'ios' | 'unavailable';

export type PWAInstallStatus =
  | 'standalone'
  | 'installed'
  | 'dismissed'
  | 'available'
  | 'unavailable';

export const PWA_SESSION_DISMISS_KEY = 'manifold_pwa_dismissed_session';
export const PWA_INSTALLED_STORAGE_KEY = 'manifold_pwa_installed_v1';

interface PersistedInstallRecord {
  installed: boolean;
  confirmedAt: string;
  method: 'standalone' | 'appinstalled' | 'userChoice' | 'ios_flow';
}

export interface PWAInstallSnapshot {
  status: PWAInstallStatus;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isStandalone: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  showIOSGuide: boolean;
  dismissedForSession: boolean;
}

export interface PWAStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PWAEnvironment {
  matchMedia?: (query: string) => { matches: boolean; addEventListener?: (type: string, cb: () => void) => void };
  navigator?: { standalone?: boolean; userAgent?: string; platform?: string; maxTouchPoints?: number };
  localStorage?: PWAStorageLike;
  sessionStorage?: PWAStorageLike;
}

function getDefaultEnv(): PWAEnvironment {
  if (typeof window === 'undefined') return {};
  return {
    matchMedia:
      typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
    navigator: window.navigator as PWAEnvironment['navigator'],
    localStorage: (() => {
      try {
        return window.localStorage;
      } catch {
        return undefined;
      }
    })(),
    sessionStorage: (() => {
      try {
        return window.sessionStorage;
      } catch {
        return undefined;
      }
    })(),
  };
}

export function detectStandalone(env: PWAEnvironment = getDefaultEnv()): boolean {
  const mediaStandalone = Boolean(env.matchMedia?.('(display-mode: standalone)').matches);
  const iosStandalone = Boolean(env.navigator?.standalone);
  return mediaStandalone || iosStandalone;
}

export function detectIOS(env: PWAEnvironment = getDefaultEnv()): boolean {
  const ua = env.navigator?.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS =
    env.navigator?.platform === 'MacIntel' && (env.navigator?.maxTouchPoints || 0) > 1;
  return isAppleMobile || isIPadOS;
}

export function readPersistedInstalled(storage?: PWAStorageLike): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(PWA_INSTALLED_STORAGE_KEY);
    if (!raw) return false;
    if (raw === '1' || raw === 'true') return true;
    const parsed = JSON.parse(raw) as Partial<PersistedInstallRecord>;
    return Boolean(parsed?.installed);
  } catch {
    return false;
  }
}

export function writePersistedInstalled(
  method: PersistedInstallRecord['method'],
  storage?: PWAStorageLike
): void {
  if (!storage) return;
  try {
    const record: PersistedInstallRecord = {
      installed: true,
      confirmedAt: new Date().toISOString(),
      method,
    };
    storage.setItem(PWA_INSTALLED_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function readSessionDismissed(storage?: PWAStorageLike): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(PWA_SESSION_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSessionDismissed(value: boolean, storage?: PWAStorageLike): void {
  if (!storage) return;
  try {
    if (value) {
      storage.setItem(PWA_SESSION_DISMISS_KEY, '1');
    } else {
      storage.removeItem(PWA_SESSION_DISMISS_KEY);
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function resolvePWAInstallStatus(params: {
  isStandalone: boolean;
  persistedInstalled: boolean;
  hasDeferredPrompt: boolean;
  isIOS: boolean;
  dismissedForSession: boolean;
}): PWAInstallStatus {
  if (params.isStandalone) return 'standalone';
  if (params.persistedInstalled) return 'installed';
  if (params.hasDeferredPrompt || params.isIOS) {
    return params.dismissedForSession ? 'dismissed' : 'available';
  }
  return 'unavailable';
}

export class PWAInstallStore {
  private env: PWAEnvironment;
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isStandalone = false;
  private persistedInstalled = false;
  private isIOS = false;
  private showIOSGuide = false;
  private dismissedForSession = false;
  private listeners = new Set<() => void>();
  private snapshotCache: PWAInstallSnapshot;

  constructor(env: PWAEnvironment = getDefaultEnv()) {
    this.env = env;
    this.isStandalone = detectStandalone(env);
    this.isIOS = detectIOS(env);
    this.persistedInstalled = readPersistedInstalled(env.localStorage);
    this.dismissedForSession = readSessionDismissed(env.sessionStorage);

    if (this.isStandalone && !this.persistedInstalled) {
      this.persistedInstalled = true;
      writePersistedInstalled('standalone', env.localStorage);
    }

    if (this.isStandalone || this.persistedInstalled) {
      this.dismissedForSession = false;
      writeSessionDismissed(false, env.sessionStorage);
    }

    this.snapshotCache = this.computeSnapshot();
  }

  private computeSnapshot(): PWAInstallSnapshot {
    const status = resolvePWAInstallStatus({
      isStandalone: this.isStandalone,
      persistedInstalled: this.persistedInstalled,
      hasDeferredPrompt: Boolean(this.deferredPrompt),
      isIOS: this.isIOS,
      dismissedForSession: this.dismissedForSession,
    });

    const isInstalled = status === 'standalone' || status === 'installed';

    return {
      status,
      deferredPrompt: isInstalled ? null : this.deferredPrompt,
      isStandalone: status === 'standalone',
      isInstalled,
      isIOS: this.isIOS,
      showIOSGuide: isInstalled ? false : this.showIOSGuide,
      dismissedForSession: this.dismissedForSession,
    };
  }

  private emitIfChanged(): void {
    const next = this.computeSnapshot();
    const prev = this.snapshotCache;
    if (
      next.status === prev.status &&
      next.deferredPrompt === prev.deferredPrompt &&
      next.isStandalone === prev.isStandalone &&
      next.isInstalled === prev.isInstalled &&
      next.isIOS === prev.isIOS &&
      next.showIOSGuide === prev.showIOSGuide &&
      next.dismissedForSession === prev.dismissedForSession
    ) {
      return;
    }
    this.snapshotCache = next;
    this.listeners.forEach((listener) => listener());
  }

  public getSnapshot = (): PWAInstallSnapshot => {
    return this.snapshotCache;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public handleBeforeInstallPrompt(event: BeforeInstallPromptEvent): void {
    event.preventDefault?.();
    if (this.isStandalone || this.persistedInstalled) {
      this.deferredPrompt = null;
      this.emitIfChanged();
      return;
    }
    this.deferredPrompt = event;
    this.emitIfChanged();
  }

  public confirmInstalled(method: PersistedInstallRecord['method'] = 'appinstalled'): void {
    this.persistedInstalled = true;
    this.deferredPrompt = null;
    this.showIOSGuide = false;
    this.dismissedForSession = false;
    if (method === 'standalone') {
      this.isStandalone = true;
    }
    writePersistedInstalled(method, this.env.localStorage);
    writeSessionDismissed(false, this.env.sessionStorage);
    this.emitIfChanged();
  }

  public syncStandaloneState(): void {
    const standaloneNow = detectStandalone(this.env);
    if (standaloneNow) {
      this.isStandalone = true;
      this.confirmInstalled('standalone');
    } else if (readPersistedInstalled(this.env.localStorage) && !this.persistedInstalled) {
      this.persistedInstalled = true;
      this.deferredPrompt = null;
      this.showIOSGuide = false;
      this.emitIfChanged();
    }
  }

  public setShowIOSGuide(open: boolean): void {
    if (this.snapshotCache.isInstalled) {
      this.showIOSGuide = false;
      this.emitIfChanged();
      return;
    }
    this.showIOSGuide = open;
    this.emitIfChanged();
  }

  public dismissInstall(): void {
    this.dismissedForSession = true;
    this.showIOSGuide = false;
    writeSessionDismissed(true, this.env.sessionStorage);
    this.emitIfChanged();
  }

  public completeIOSInstallFlow(): void {
    this.confirmInstalled('ios_flow');
  }

  public async promptInstall(): Promise<InstallPromptResult> {
    const snap = this.getSnapshot();
    if (snap.isInstalled) return 'unavailable';

    if (this.deferredPrompt) {
      const promptEvent = this.deferredPrompt;
      this.deferredPrompt = null;
      this.emitIfChanged();
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        this.confirmInstalled('userChoice');
      } else if (choice.outcome === 'dismissed') {
        this.dismissInstall();
      }
      return choice.outcome;
    }

    if (this.isIOS) {
      this.setShowIOSGuide(true);
      return 'ios';
    }

    return 'unavailable';
  }
}

const SERVER_SNAPSHOT: PWAInstallSnapshot = {
  status: 'unavailable',
  deferredPrompt: null,
  isStandalone: false,
  isInstalled: false,
  isIOS: false,
  showIOSGuide: false,
  dismissedForSession: false,
};

let clientStore: PWAInstallStore | null = null;
let domListenersAttached = false;

function getClientStore(): PWAInstallStore {
  if (!clientStore) {
    clientStore = new PWAInstallStore(getDefaultEnv());
  }
  if (!domListenersAttached && typeof window !== 'undefined') {
    domListenersAttached = true;

    const handleBeforeInstallPrompt = (e: Event) => {
      clientStore?.handleBeforeInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      clientStore?.confirmInstalled('appinstalled');
    };

    const handleDisplayModeChange = () => {
      clientStore?.syncStandaloneState();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PWA_INSTALLED_STORAGE_KEY || e.key === null) {
        clientStore?.syncStandaloneState();
      }
    };

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('storage', handleStorageChange);
    mql?.addEventListener?.('change', handleDisplayModeChange);
  }
  return clientStore;
}

// Initialize immediately on client evaluation so early beforeinstallprompt events are captured.
if (typeof window !== 'undefined') {
  getClientStore();
}

function subscribe(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  return getClientStore().subscribe(listener);
}

function getSnapshot(): PWAInstallSnapshot {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  return getClientStore().getSnapshot();
}

function getServerSnapshot(): PWAInstallSnapshot {
  return SERVER_SNAPSHOT;
}

export function usePWAInstall() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setShowIOSGuide = useCallback((open: boolean) => {
    getClientStore().setShowIOSGuide(open);
  }, []);

  const dismissInstall = useCallback(() => {
    getClientStore().dismissInstall();
  }, []);

  const completeIOSInstallFlow = useCallback(() => {
    getClientStore().completeIOSInstallFlow();
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallPromptResult> => {
    return getClientStore().promptInstall();
  }, []);

  const canInstall =
    !snapshot.isInstalled && (Boolean(snapshot.deferredPrompt) || snapshot.isIOS);

  return {
    installStatus: snapshot.status,
    isStandalone: snapshot.isStandalone,
    isInstalled: snapshot.isInstalled,
    isIOS: snapshot.isIOS,
    canInstall,
    hasNativePrompt: Boolean(snapshot.deferredPrompt),
    showIOSGuide: snapshot.showIOSGuide,
    dismissedForSession: snapshot.dismissedForSession,
    setShowIOSGuide,
    dismissInstall,
    completeIOSInstallFlow,
    promptInstall,
  };
}
