import React from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export interface FloatingInstallButtonProps {
  onTriggered?: () => void;
}

/**
 * Prominent bottom-right floating "Install MANIFOLD" CTA.
 * Uses the shared usePWAInstall store (`beforeinstallprompt` on Chromium and
 * `IOSInstallModal` Share -> Add to Home Screen guidance on iOS Safari),
 * positioned cleanly above the AI concierge trigger so nothing overlaps.
 */
export const FloatingInstallButton: React.FC<FloatingInstallButtonProps> = ({
  onTriggered,
}) => {
  const {
    canInstall,
    isInstalled,
    isIOS,
    dismissedForSession,
    dismissInstall,
    promptInstall,
    setShowIOSGuide,
  } = usePWAInstall();

  if (isInstalled || !canInstall || dismissedForSession) {
    return null;
  }

  const handleInstallClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'unavailable' && isIOS) {
      setShowIOSGuide(true);
    }
    onTriggered?.();
  };

  return (
    <div
      className="fixed right-4 sm:right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-3 duration-300"
      data-testid="floating-pwa-install"
    >
      <div className="inline-flex items-center rounded-xl bg-[#EF233C] shadow-xl shadow-[#EF233C]/30 ring-1 ring-white/20 overflow-hidden transition-all duration-150 hover:shadow-2xl hover:shadow-[#EF233C]/40">
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="inline-flex items-center gap-2 min-h-[44px] pl-3.5 pr-3 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-xs font-bold tracking-wide transition-all duration-150 whitespace-nowrap cursor-pointer"
          title={
            isIOS
              ? 'View iOS Home Screen installation steps'
              : 'Install MANIFOLD app on your device'
          }
          aria-label="Install MANIFOLD"
        >
          <Download className="w-4 h-4 text-white shrink-0" />
          <span>Install MANIFOLD</span>
        </button>
        <button
          type="button"
          onClick={dismissInstall}
          className="min-w-[36px] min-h-[44px] px-2 flex items-center justify-center bg-black/15 hover:bg-black/30 text-white/90 hover:text-white border-l border-white/15 transition-colors cursor-pointer"
          title="Dismiss install button for this session"
          aria-label="Dismiss Install MANIFOLD"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
