import React from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { ManifoldBrandMark } from '../ManifoldBrandMark';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer';
  onTriggered?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onTriggered,
}) => {
  const { canInstall, isInstalled, showIOSGuide, setShowIOSGuide, promptInstall } = usePWAInstall();

  if (isInstalled || !canInstall) return null;

  const handleClick = async () => {
    onTriggered?.();
    await promptInstall();
  };

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-bold uppercase tracking-wider py-3 px-4 rounded-lg transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#EF233C] shrink-0" />
          <span>Install MANIFOLD App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="hidden md:inline-flex items-center gap-1.5 min-h-[36px] px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-gray-100 text-[11px] font-bold uppercase tracking-wider transition cursor-pointer shrink-0"
          title="Install MANIFOLD app on your device"
          aria-label="Install MANIFOLD app"
        >
          <Download className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
          <span>Install</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="manifold-ios-install-title"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-[#071A2B] text-white border border-white/15 rounded-2xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <ManifoldBrandMark size="sm" />
                <div>
                  <h3 id="manifold-ios-install-title" className="text-sm font-extrabold font-display">
                    Install MANIFOLD on iPhone/iPad
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Launch full-screen right from your Home Screen
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-gray-200">
              <li className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <Share className="w-4 h-4 text-[#EF233C] shrink-0" />
                <span>
                  Tap the <strong>Share</strong> button in Safari&apos;s browser toolbar.
                </span>
              </li>
              <li className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <PlusSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Scroll down and tap <strong>Add to Home Screen</strong>, then confirm <strong>Add</strong>.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
