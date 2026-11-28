import React, { useEffect } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { ManifoldBrandMark } from '../ManifoldBrandMark';
import { FloatingInstallButton } from './FloatingInstallButton';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer' | 'compact' | 'floating';
  onTriggered?: () => void;
}

export const IOSInstallModal: React.FC = () => {
  const { showIOSGuide, isInstalled, setShowIOSGuide, completeIOSInstallFlow } = usePWAInstall();

  useEffect(() => {
    if (!showIOSGuide) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowIOSGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showIOSGuide, setShowIOSGuide]);

  if (!showIOSGuide || isInstalled) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
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
                Install MANIFOLD on iOS
              </h3>
              <p className="text-[11px] text-gray-400">
                Add MANIFOLD to your Home Screen for full-screen access
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Close install instructions"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="space-y-2.5 text-xs text-gray-200">
          <li className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="w-7 h-7 rounded-lg bg-[#EF233C]/15 border border-[#EF233C]/30 flex items-center justify-center shrink-0">
              <Share className="w-4 h-4 text-[#EF233C]" />
            </span>
            <span>
              Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
            </span>
          </li>
          <li className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <PlusSquare className="w-4 h-4 text-emerald-400" />
            </span>
            <span>
              Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
            </span>
          </li>
        </ol>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={completeIOSInstallFlow}
            className="w-full min-h-[44px] rounded-xl bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-xs font-bold tracking-wide transition-all duration-150 cursor-pointer"
          >
            Done, Added to Home Screen
          </button>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="w-full min-h-[38px] rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  onTriggered,
}) => {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();

  if (variant === 'floating') {
    return <FloatingInstallButton onTriggered={onTriggered} />;
  }

  // Stop showing install prompts anywhere once MANIFOLD is installed or running standalone
  if (isInstalled || !canInstall) {
    return null;
  }

  const handleClick = async () => {
    await promptInstall();
    onTriggered?.();
  };

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-xs font-bold tracking-wide py-3 px-4 rounded-lg shadow-sm hover:shadow-md hover:shadow-[#EF233C]/25 transition-all duration-150 cursor-pointer"
        aria-label="Install MANIFOLD"
      >
        <Download className="w-4 h-4 text-white shrink-0" />
        <span>Install MANIFOLD</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-xs font-bold tracking-wide shadow-md hover:shadow-lg hover:shadow-[#EF233C]/25 transition-all duration-150 cursor-pointer"
        aria-label="Install MANIFOLD"
      >
        <Download className="w-3.5 h-3.5 text-white shrink-0" />
        <span>Install MANIFOLD</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      className="hidden md:inline-flex items-center gap-1.5 min-h-[38px] xl:min-h-[40px] px-2.5 xl:px-3.5 py-2 rounded-lg bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-[11px] xl:text-xs font-bold tracking-wide shadow-sm hover:shadow-md hover:shadow-[#EF233C]/25 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
      title="Install MANIFOLD on your device"
      aria-label="Install MANIFOLD"
    >
      <Download className="w-3.5 h-3.5 text-white shrink-0" />
      <span>Install MANIFOLD</span>
    </button>
  );
};
