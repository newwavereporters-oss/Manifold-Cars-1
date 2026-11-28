import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((window.navigator as { standalone?: boolean }).standalone);
  return mediaStandalone || iosStandalone;
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS =
    window.navigator.platform === 'MacIntel' && (window.navigator.maxTouchPoints || 0) > 1;
  return isAppleMobile || isIPadOS;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS] = useState<boolean>(() => detectIOS());
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSGuide(false);
    };

    const mql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayModeChange = () => {
      if (detectStandalone()) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mql?.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql?.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> => {
    if (isInstalled) return 'unavailable';

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      return choice.outcome;
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return 'ios';
    }

    return 'unavailable';
  }, [deferredPrompt, isIOS, isInstalled]);

  return {
    isInstalled,
    isIOS,
    canInstall: !isInstalled && (Boolean(deferredPrompt) || isIOS),
    hasNativePrompt: Boolean(deferredPrompt),
    showIOSGuide,
    setShowIOSGuide,
    promptInstall,
  };
}
