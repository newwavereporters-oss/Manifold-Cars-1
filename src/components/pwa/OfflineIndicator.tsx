import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { IOSInstallModal } from './PWAInstallButton';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setNeedRefresh(true);
        },
        onRegisterError() {
          // Silently ignore SW registration failures on unsupported contexts
        },
      });
      updateSwRef.current = updateSW;
    } catch {
      // Ignore in non-browser/SSR contexts
    }
  }, []);

  return (
    <>
      <IOSInstallModal />

      {(!isOnline || needRefresh) && (
        <div className="fixed bottom-4 left-4 z-[90] flex flex-col gap-2 max-w-[calc(100vw-2rem)] pointer-events-none">
          {!isOnline && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto inline-flex items-center gap-2 bg-[#071A2B]/95 text-white border border-amber-400/40 px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Offline mode — cached shell ready; live data requires internet.</span>
            </div>
          )}

          {needRefresh && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-auto inline-flex items-center gap-3 bg-[#071A2B]/95 text-white border border-white/20 px-3.5 py-2 rounded-xl shadow-xl text-xs font-semibold"
            >
              <span>New MANIFOLD update ready.</span>
              <button
                type="button"
                onClick={() => void updateSwRef.current?.(true)}
                className="inline-flex items-center gap-1 bg-[#EF233C] hover:bg-[#d91b32] text-white px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reload</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
