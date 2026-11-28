import { useCallback, useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type InstallPromptResult = 'accepted' | 'dismissed' | 'ios' | 'unavailable';

interface PWAInstallSnapshot {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOS: boolean;
  showIOSGuide: boolean;
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

export function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS =
    window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  return isAppleMobile || isIPadOS;
}

const SERVER_SNAPSHOT: PWAInstallSnapshot = {
  deferredPrompt: null,
  isInstalled: false,
  isIOS: false,
  showIOSGuide: false,
};

let storeState: PWAInstallSnapshot = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function updateStore(patch: Partial<PWAInstallSnapshot>) {
  const next: PWAInstallSnapshot = { ...storeState, ...patch };
  if (
    next.deferredPrompt === storeState.deferredPrompt &&
    next.isInstalled === storeState.isInstalled &&
    next.isIOS === storeState.isIOS &&
    next.showIOSGuide === storeState.showIOSGuide
  ) {
    return;
  }
  storeState = next;
  emitChange();
}

function ensureInitialized() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  storeState = {
    deferredPrompt: null,
    isInstalled: detectStandalone(),
    isIOS: detectIOS(),
    showIOSGuide: false,
  };

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    updateStore({
      deferredPrompt: e as BeforeInstallPromptEvent,
    });
  };

  const handleAppInstalled = () => {
    updateStore({
      isInstalled: true,
      deferredPrompt: null,
      showIOSGuide: false,
    });
  };

  const mql =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)')
      : null;

  const handleDisplayModeChange = () => {
    if (detectStandalone()) {
      updateStore({
        isInstalled: true,
        deferredPrompt: null,
        showIOSGuide: false,
      });
    }
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
  mql?.addEventListener?.('change', handleDisplayModeChange);
}

// Initialize immediately on client module evaluation so early beforeinstallprompt events are never missed.
ensureInitialized();

function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PWAInstallSnapshot {
  ensureInitialized();
  return storeState;
}

function getServerSnapshot(): PWAInstallSnapshot {
  return SERVER_SNAPSHOT;
}

export function usePWAInstall() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setShowIOSGuide = useCallback((open: boolean) => {
    updateStore({ showIOSGuide: open });
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallPromptResult> => {
    const current = getSnapshot();
    if (current.isInstalled) return 'unavailable';

    if (current.deferredPrompt) {
      const promptEvent = current.deferredPrompt;
      updateStore({ deferredPrompt: null });
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        updateStore({
          isInstalled: true,
          deferredPrompt: null,
          showIOSGuide: false,
        });
      }
      return choice.outcome;
    }

    if (current.isIOS) {
      updateStore({ showIOSGuide: true });
      return 'ios';
    }

    return 'unavailable';
  }, []);

  const canInstall = !snapshot.isInstalled && (Boolean(snapshot.deferredPrompt) || snapshot.isIOS);

  return {
    isInstalled: snapshot.isInstalled,
    isIOS: snapshot.isIOS,
    canInstall,
    hasNativePrompt: Boolean(snapshot.deferredPrompt),
    showIOSGuide: snapshot.showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  };
}
