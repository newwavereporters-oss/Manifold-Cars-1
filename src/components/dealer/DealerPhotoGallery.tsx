import React, { useRef, useState } from 'react';
import {
  Upload,
  Link2,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Camera,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import {
  formatFileSizeKb,
  shouldShowTinyPngHint,
  TINYPNG_HINT_MESSAGE,
  TINYPNG_URL,
  VehicleImageErrorCode,
} from '../../utils/imageOptimizer';
import {
  deleteVehicleImageByUrl,
  uploadVehicleImage,
  VehicleImageSlot,
} from '../../services/vehicleImageService';
import { WatermarkedVehicleImage } from '../WatermarkedVehicleImage';

interface SlotMeta {
  slot: VehicleImageSlot;
  title: string;
  subtitle: string;
  required?: boolean;
  value: string;
  onChange: (nextUrl: string) => void;
}

interface DealerPhotoGalleryProps {
  dealerId: string;
  vehicleId: string;
  image1Url: string;
  image2Url: string;
  onChangeImage1: (nextUrl: string) => void;
  onChangeImage2: (nextUrl: string) => void;
  disabled?: boolean;
}

interface SlotStatusState {
  mode: 'upload' | 'url';
  uploading: boolean;
  dragging: boolean;
  error: string | null;
  errorCode: VehicleImageErrorCode | null;
  optimizedSizeBytes: number | null;
}

const DEFAULT_SLOT_STATE: SlotStatusState = {
  mode: 'upload',
  uploading: false,
  dragging: false,
  error: null,
  errorCode: null,
  optimizedSizeBytes: null,
};

export const DealerPhotoGallery: React.FC<DealerPhotoGalleryProps> = ({
  dealerId,
  vehicleId,
  image1Url,
  image2Url,
  onChangeImage1,
  onChangeImage2,
  disabled = false,
}) => {
  const [slotStates, setSlotStates] = useState<Record<VehicleImageSlot, SlotStatusState>>({
    'front-exterior': { ...DEFAULT_SLOT_STATE },
    cabin: { ...DEFAULT_SLOT_STATE },
  });

  const fileInputRefs = useRef<Record<VehicleImageSlot, HTMLInputElement | null>>({
    'front-exterior': null,
    cabin: null,
  });

  const updateSlotState = (
    slot: VehicleImageSlot,
    updater: Partial<SlotStatusState>
  ) => {
    setSlotStates((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], ...updater },
    }));
  };

  const handleFilesSelected = async (
    slot: VehicleImageSlot,
    files: FileList | null,
    currentUrl: string,
    onChange: (nextUrl: string) => void
  ) => {
    if (!files || files.length === 0 || disabled) return;
    const file = files[0];

    updateSlotState(slot, {
      uploading: true,
      dragging: false,
      error: null,
      errorCode: null,
    });

    try {
      const result = await uploadVehicleImage({
        file,
        dealerId,
        vehicleId,
        slot,
        previousUrl: currentUrl,
      });

      onChange(result.publicUrl);
      updateSlotState(slot, {
        uploading: false,
        error: null,
        errorCode: null,
        optimizedSizeBytes: result.optimizedSizeBytes,
      });
    } catch (err: any) {
      const code = (err?.code || 'UPLOAD_FAILED') as VehicleImageErrorCode;
      updateSlotState(slot, {
        uploading: false,
        error:
          code === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
            ? TINYPNG_HINT_MESSAGE
            : err?.message || 'Unable to upload photo. Please try again.',
        errorCode: code,
      });
    } finally {
      const input = fileInputRefs.current[slot];
      if (input) input.value = '';
    }
  };

  const handleRemovePhoto = async (
    slot: VehicleImageSlot,
    currentUrl: string,
    onChange: (nextUrl: string) => void
  ) => {
    if (disabled) return;
    onChange('');
    updateSlotState(slot, {
      error: null,
      errorCode: null,
      optimizedSizeBytes: null,
    });
    if (currentUrl) {
      await deleteVehicleImageByUrl(currentUrl);
    }
  };

  const slots: SlotMeta[] = [
    {
      slot: 'front-exterior',
      title: 'Image 1 — Front Exterior',
      subtitle: 'Required for publishing • Front 3/4 view in natural daylight',
      required: true,
      value: image1Url,
      onChange: onChangeImage1,
    },
    {
      slot: 'cabin',
      title: 'Image 2 — Cabin / Cockpit',
      subtitle: 'Optional • Dashboard, steering wheel, and interior seating',
      required: false,
      value: image2Url,
      onChange: onChangeImage2,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500">
          Upload directly from your phone or computer (JPG, PNG, WebP — automatically optimized under 100 KB), or paste an image link.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {slots.map(({ slot, title, subtitle, required, value, onChange }) => {
          const state = slotStates[slot];
          const hasImage = Boolean((value || '').trim());
          const showTinyPng = shouldShowTinyPngHint(state.errorCode);

          return (
            <div
              key={slot}
              className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 flex flex-col gap-3"
            >
              {/* Header & Mode Switch */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                    <span>{title}</span>
                    {required && <span className="text-[#EF233C]">*</span>}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>
                </div>

                <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={disabled || state.uploading}
                    onClick={() =>
                      updateSlotState(slot, {
                        mode: 'upload',
                        error: null,
                        errorCode: null,
                      })
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      state.mode === 'upload'
                        ? 'bg-[#071A2B] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Photo</span>
                  </button>
                  <button
                    type="button"
                    disabled={disabled || state.uploading}
                    onClick={() =>
                      updateSlotState(slot, {
                        mode: 'url',
                        error: null,
                        errorCode: null,
                      })
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors ${
                      state.mode === 'url'
                        ? 'bg-[#071A2B] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Link2 className="w-3 h-3" />
                    <span>Enter URL</span>
                  </button>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  fileInputRefs.current[slot] = el;
                }}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                disabled={disabled || state.uploading}
                onChange={(e) =>
                  void handleFilesSelected(slot, e.target.files, value, onChange)
                }
                className="hidden"
                aria-label={title}
              />

              {/* Preview when photo is present */}
              {hasImage && (
                <div className="space-y-2">
                  <div className="relative h-44 w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <WatermarkedVehicleImage
                      src={value}
                      alt={title}
                      className="w-full h-full"
                      imgClassName="w-full h-full object-cover"
                      watermarkSize="md"
                    />
                    {state.uploading && (
                      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] flex flex-col items-center justify-center text-white gap-2">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-bold">Optimizing & uploading...</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 min-w-0">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {state.optimizedSizeBytes
                          ? `Optimized (${formatFileSizeKb(state.optimizedSizeBytes)})`
                          : 'Photo attached'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {state.mode === 'upload' && (
                        <button
                          type="button"
                          disabled={disabled || state.uploading}
                          onClick={() => fileInputRefs.current[slot]?.click()}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 text-[11px] font-bold flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={disabled || state.uploading}
                        onClick={() => void handleRemovePhoto(slot, value, onChange)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[#EF233C] text-[11px] font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Dropzone (shown in upload mode when empty or ready) */}
              {state.mode === 'upload' && !hasImage && (
                <div
                  role="button"
                  tabIndex={disabled || state.uploading ? -1 : 0}
                  onClick={() => {
                    if (!disabled && !state.uploading) {
                      fileInputRefs.current[slot]?.click();
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !disabled && !state.uploading) {
                      e.preventDefault();
                      fileInputRefs.current[slot]?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled && !state.uploading) {
                      updateSlotState(slot, { dragging: true });
                    }
                  }}
                  onDragLeave={() => updateSlotState(slot, { dragging: false })}
                  onDrop={(e) => {
                    e.preventDefault();
                    updateSlotState(slot, { dragging: false });
                    if (!disabled && !state.uploading) {
                      void handleFilesSelected(slot, e.dataTransfer.files, value, onChange);
                    }
                  }}
                  className={`h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4 transition-colors cursor-pointer ${
                    state.dragging
                      ? 'border-[#EF233C] bg-red-50/70'
                      : 'border-gray-300 bg-white hover:border-[#071A2B] hover:bg-gray-50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {state.uploading ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin text-[#EF233C] mb-2" />
                      <p className="text-xs font-bold text-gray-800">
                        Optimizing & uploading photo...
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Compressing to under 100 KB
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center mb-2">
                        <Camera className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-gray-800">
                        Click to upload or drag & drop
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        JPG, JPEG, PNG or WebP
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Manual URL Input */}
              {state.mode === 'url' && (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-gray-700">
                    Image URL
                  </label>
                  <input
                    type="url"
                    disabled={disabled || state.uploading}
                    value={value}
                    onChange={(e) => {
                      updateSlotState(slot, {
                        error: null,
                        errorCode: null,
                        optimizedSizeBytes: null,
                      });
                      onChange(e.target.value);
                    }}
                    placeholder="https://example.com/vehicle-photo.jpg"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#EF233C]/20"
                  />
                </div>
              )}

              {/* Slot Error Message & Conditional TinyPNG Guidance */}
              {state.error && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#EF233C]" />
                  <div className="space-y-1 leading-relaxed">
                    {showTinyPng ? (
                      <p>
                        Image is still too large to upload. You can reduce its size using{' '}
                        <a
                          href={TINYPNG_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline text-[#EF233C] inline-flex items-center gap-0.5 hover:text-[#D90429]"
                        >
                          <span>TinyPNG</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>{' '}
                        and try again.
                      </p>
                    ) : (
                      <p>{state.error}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
