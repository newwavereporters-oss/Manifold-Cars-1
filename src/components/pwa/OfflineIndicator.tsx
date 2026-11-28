import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { IOSInstallModal } from './PWAInstallButton';

const UPDATE_CHECK_MIN_INTERVAL_MS = 60_000;
const UPDATE_CHECK_POLL_MS = 30 * 60_000;

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastUpdateCheckRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const triggerUpdateCheck = (force = false) => {
      const reg = swRegistrationRef.current;
      if (!reg) return;
      const now = Date.now();
      if (!force && now - lastUpdateCheckRef.current < UPDATE_CHECK_MIN_INTERVAL_MS) return;
      lastUpdateCheckRef.current = now;
      void reg.update().catch(() => {});
    };

    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
          setUpdateDismissed(false);
        },
        onRegisteredSW(_swUrl, registration) {
          if (registration) {
            swRegistrationRef.current = registration;
            if (registration.waiting) {
              setNeedRefresh(true);
              setUpdateDismissed(false);
            }
            triggerUpdateCheck(true);
          }
        },
        onRegisterError() {
          // Silently ignore SW registration failures on unsupported contexts
        },
      });
      updateSwRef.current = updateSW;
    } catch {
      // Ignore in non-browser/SSR contexts
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerUpdateCheck(false);
      }
    };
    const handleOnline = () => {
      triggerUpdateCheck(true);
    };
    const handleFocus = () => {
      triggerUpdateCheck(false);
    };

    const intervalId = window.setInterval(() => {
      triggerUpdateCheck(false);
    }, UPDATE_CHECK_POLL_MS);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleApplyUpdate = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (updateSwRef.current) {
        await updateSwRef.current(true);
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  const showUpdateNudge = needRefresh && !updateDismissed;

  return (
    <>
      <IOSInstallModal />

      {(!isOnline || showUpdateNudge) && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-[90] flex flex-col gap-2 max-w-[calc(100vw-2rem)] pointer-events-none">
          {!isOnline && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto inline-flex items-center gap-2 bg-[#071A2B]/95 text-white border border-amber-400/40 px-3.5 py-2.5 rounded-xl shadow-xl text-xs font-semibold"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Offline mode — cached shell ready; live data requires internet.</span>
            </div>
          )}

          {showUpdateNudge && (
            <div
              role="status"
              aria-live="polite"
              data-testid="pwa-update-nudge"
              className="pointer-events-auto flex items-center justify-between gap-3 bg-[#071A2B]/98 text-white border border-white/20 px-4 py-3 rounded-xl shadow-2xl text-xs max-w-sm"
            >
              <div className="min-w-0">
                <p className="font-bold text-white leading-tight">
                  MANIFOLD Update Ready
                </p>
                <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                  Refresh to apply the latest update without reinstalling.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => void handleApplyUpdate()}
                  className="inline-flex items-center gap-1.5 min-h-[36px] bg-[#EF233C] hover:bg-[#d91b32] disabled:opacity-70 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                  <span>{isUpdating ? 'Updating…' : 'Refresh App'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateDismissed(true)}
                  className="min-w-[32px] min-h-[36px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  aria-label="Dismiss update notification"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
