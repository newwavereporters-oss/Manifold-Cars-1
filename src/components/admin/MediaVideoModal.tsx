import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Play,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Car } from '../../types';
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isValidYouTubeUrl,
  formatStandardYouTubeUrl,
} from '../../utils/youtube';
import { MediaVideoItem, MediaVideoType } from '../../services/mediaService';

interface MediaVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (videoData: Partial<MediaVideoItem>) => Promise<void>;
  cars: Car[];
  initialVideo?: MediaVideoItem | null;
}

export const MediaVideoModal: React.FC<MediaVideoModalProps> = ({
  isOpen,
  onClose,
  onSave,
  cars,
  initialVideo,
}) => {
  const [title, setTitle] = useState('');
  const [videoType, setVideoType] = useState<MediaVideoType>('Car Review');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [carId, setCarId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<MediaVideoItem['status']>('Published');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPrimary, setIsPrimary] = useState(false);
  const [duration, setDuration] = useState('12:00');
  const [presenter, setPresenter] = useState('MANIFOLD Media Team');

  const [detectedVideoId, setDetectedVideoId] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialVideo) {
      setTitle(initialVideo.title || '');
      setVideoType(initialVideo.video_type || 'Car Review');
      setYoutubeUrl(initialVideo.youtube_url || '');
      setCarId(initialVideo.car_id || '');
      setDescription(initialVideo.description || '');
      setStatus(initialVideo.status || 'Published');
      setIsFeatured(!!initialVideo.is_featured);
      setIsPrimary(!!initialVideo.is_primary);
      setDuration(initialVideo.duration || '12:00');
      setPresenter(initialVideo.presenter || 'MANIFOLD Media Team');
    } else {
      setTitle('');
      setVideoType('Car Review');
      setYoutubeUrl('');
      setCarId('');
      setDescription('');
      setStatus('Published');
      setIsFeatured(false);
      setIsPrimary(false);
      setDuration('12:00');
      setPresenter('MANIFOLD Media Team');
    }
    setValidationError(null);
  }, [initialVideo, isOpen]);

  // YouTube live detection
  useEffect(() => {
    if (!youtubeUrl.trim()) {
      setDetectedVideoId(null);
      setThumbnailUrl('');
      setIsValidUrl(false);
      return;
    }

    const id = extractYouTubeVideoId(youtubeUrl);
    if (id) {
      setDetectedVideoId(id);
      setThumbnailUrl(getYouTubeThumbnailUrl(id, 'maxres'));
      setIsValidUrl(true);
    } else {
      setDetectedVideoId(null);
      setThumbnailUrl('');
      setIsValidUrl(false);
    }
  }, [youtubeUrl]);

  // Auto-fill title when vehicle is selected
  const handleCarSelect = (selectedId: string) => {
    setCarId(selectedId);
    const selectedCar = cars.find((c) => c.id === selectedId);
    if (selectedCar) {
      if (!title || title.includes('Review')) {
        setTitle(`${selectedCar.title} Full Review & Inspection`);
      }
      if (!description) {
        setDescription(`Comprehensive review, road test, and inspection walkthrough of the ${selectedCar.title}.`);
      }
    }
  };

  const handleFillSample = () => {
    setYoutubeUrl('https://www.youtube.com/watch?v=w4-z4_h1wR0');
    if (!title && cars[0]) {
      setTitle(`${cars[0].title} In-Depth Market Review`);
      setCarId(cars[0].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('Please enter a video review title.');
      return;
    }

    if (!youtubeUrl.trim() || !detectedVideoId || !isValidUrl) {
      setValidationError('Enter a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=XXXXXXXX).');
      return;
    }

    setIsSaving(true);
    try {
      const selectedCar = cars.find((c) => c.id === carId);

      await onSave({
        id: initialVideo?.id,
        title: title.trim(),
        video_type: videoType,
        youtube_url: formatStandardYouTubeUrl(detectedVideoId),
        youtube_video_id: detectedVideoId,
        youtube_thumbnail_url: thumbnailUrl,
        car_id: carId || undefined,
        car_title: selectedCar ? selectedCar.title : undefined,
        description: description.trim(),
        status,
        is_featured: isFeatured,
        is_primary: isPrimary,
        duration: duration.trim() || '12:00',
        presenter: presenter.trim() || 'MANIFOLD Media Team',
      });
      setIsSaving(false);
      onClose();
    } catch (err: any) {
      setIsSaving(false);
      setValidationError(err.message || 'Failed to save media video review.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-[#071A2B] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EF233C] flex items-center justify-center text-white shadow">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm font-display tracking-wide">
                {initialVideo ? 'Edit Video Review' : 'Add Vehicle Review Video'}
              </h3>
              <p className="text-[10px] text-gray-300 uppercase tracking-widest mt-0.5">
                MANIFOLD Media & Reviews CMS
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5">
          {validationError && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Quick Demo Helper */}
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#EF233C]" />
              Need a sample YouTube URL?
            </span>
            <button
              type="button"
              onClick={handleFillSample}
              className="text-[#EF233C] font-bold hover:underline cursor-pointer"
            >
              Fill Sample URL
            </button>
          </div>

          {/* Video Title & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Review Title <span className="text-[#EF233C]">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2021 Toyota Highlander XLE Review"
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Video Type <span className="text-[#EF233C]">*</span>
              </label>
              <select
                value={videoType}
                onChange={(e) => setVideoType(e.target.value as MediaVideoType)}
                className="w-full h-10 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
              >
                <option value="Car Review">Car Review</option>
                <option value="Car Walkaround">Car Walkaround</option>
                <option value="Car Hunt">Car Hunt</option>
                <option value="Buying Guide">Buying Guide</option>
                <option value="Market Insight">Market Insight</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* YouTube Video URL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                YouTube Video URL <span className="text-[#EF233C]">*</span>
              </label>
              {isValidUrl && detectedVideoId && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ Valid YouTube URL ({detectedVideoId})
                </span>
              )}
            </div>
            <input
              type="url"
              required
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=XXXXXXXX"
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none"
            />
          </div>

          {/* Live Preview Box */}
          {detectedVideoId && isValidUrl && (
            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 flex gap-4 items-center">
              <div className="relative aspect-video w-36 bg-black rounded-lg overflow-hidden shrink-0">
                <img
                  src={thumbnailUrl}
                  alt="YouTube thumbnail preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://img.youtube.com/vi/${detectedVideoId}/hqdefault.jpg`;
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="w-5 h-5 text-white fill-current" />
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-[#EF233C] text-white rounded">
                  PREVIEW
                </span>
                <p className="font-bold text-gray-900 line-clamp-1">{title || 'Video Title'}</p>
                <p className="text-[11px] text-gray-500 font-mono">ID: {detectedVideoId}</p>
                <p className="text-[11px] text-emerald-700 font-medium">✓ Thumbnail auto-generated from YouTube</p>
              </div>
            </div>
          )}

          {/* Associated Vehicle (PART 15) */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
              Associate With Vehicle In Inventory
            </label>
            <select
              value={carId}
              onChange={(e) => handleCarSelect(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:border-[#071A2B] outline-none"
            >
              <option value="">-- No vehicle association (General Editorial Video) --</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.year} {c.make} {c.model} - {c.location}
                </option>
              ))}
            </select>

            {/* Primary Video Toggle (PART 16) */}
            {carId && (
              <div className="pt-2 border-t border-gray-200">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="w-4 h-4 text-[#EF233C] rounded border-gray-300 focus:ring-[#EF233C]"
                  />
                  <span>Designate as Primary Review Video for this vehicle</span>
                </label>
                <p className="text-[10px] text-gray-500 mt-1 pl-6">
                  Making this primary will update the vehicle card and details page to display this video as its main visual.
                </p>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="12:00"
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                Presenter
              </label>
              <input
                type="text"
                value={presenter}
                onChange={(e) => setPresenter(e.target.value)}
                placeholder="Presenter name"
                className="w-full h-9 px-2.5 bg-gray-50 border border-gray-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MediaVideoItem['status'])}
                className="w-full h-9 px-2 bg-gray-50 border border-gray-200 rounded text-xs font-semibold"
              >
                <option value="Published">Published</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div className="flex flex-col justify-end pb-1.5">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#EF233C] rounded border-gray-300"
                />
                <span>Featured</span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key vehicle review highlights, road test takeaways..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{initialVideo ? 'Update Video' : 'Save Video'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
