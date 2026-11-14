import React, { useEffect, useState } from 'react';
import {
  Disc3,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  MUSIC_CATEGORIES,
  musicLibrary,
  MusicCategory,
  MusicPlayerSnapshot,
} from '../../utils/musicLibraryService';

interface MusicLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const MusicLibraryModal: React.FC<MusicLibraryModalProps> = ({ isOpen, onClose }) => {
  const [snap, setSnap] = useState<MusicPlayerSnapshot>(() => musicLibrary.getSnapshot());
  const [uploadCategory, setUploadCategory] = useState<MusicCategory>('AFROBEATS');

  useEffect(() => {
    return musicLibrary.subscribe(setSnap);
  }, []);

  if (!isOpen) return null;

  const visibleTracks =
    snap.selectedCategory === 'ALL'
      ? snap.tracks
      : snap.tracks.filter((t) => t.category === snap.selectedCategory);

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const blobUrl = URL.createObjectURL(file);
    const cleanName = file.name.replace(/\.[^.]+$/, '');
    musicLibrary.addCustomLocalOrUrlTrack({
      title: cleanName,
      artist: 'Uploaded Audio',
      category: uploadCategory,
      audioUrl: blobUrl,
      sourceKind: 'LOCAL_FILE',
    });
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        className="w-full max-w-2xl bg-[#071A2B] border border-white/20 rounded-3xl p-5 sm:p-6 shadow-2xl text-white max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Manifold Music Library</h3>
              <p className="text-xs text-slate-400">
                Plays persistently across camera & HUD switches while driving
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors"
            aria-label="Close Music Library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Deck */}
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl bg-slate-900 border border-white/15 flex items-center justify-center shrink-0 ${
                  snap.isPlaying ? 'text-cyan-300' : 'text-slate-400'
                }`}
              >
                <Disc3 className={`w-6 h-6 ${snap.isPlaying ? 'animate-spin' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-cyan-300 font-medium">
                  <span>
                    {MUSIC_CATEGORIES.find((c) => c.id === snap.activeTrack.category)?.label ||
                      snap.activeTrack.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{snap.activeTrack.bpm} BPM</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatClock(snap.elapsedSec)} / {formatClock(snap.activeTrack.durationSec)}
                  </span>
                </div>
                <p className="text-base font-bold text-white truncate">{snap.activeTrack.title}</p>
                <p className="text-xs text-slate-400 truncate">{snap.activeTrack.artist}</p>
              </div>
            </div>

            {/* Playback & Volume Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => musicLibrary.prevTrack()}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Previous track"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => musicLibrary.togglePlayPause()}
                className="w-11 h-11 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center justify-center shadow-lg transition-colors"
                aria-label={snap.isPlaying ? 'Pause music' : 'Play music'}
              >
                {snap.isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => musicLibrary.nextTrack()}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                aria-label="Next track"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <div className="h-6 w-px bg-white/10 mx-1" />

              <button
                type="button"
                onClick={() => musicLibrary.toggleMute()}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 transition-colors"
                aria-label={snap.isMuted ? 'Unmute music' : 'Mute music'}
              >
                {snap.isMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-300" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(snap.volume * 100)}
                onChange={(e) => musicLibrary.setVolume(Number(e.target.value) / 100)}
                className="w-16 sm:w-20 accent-cyan-400 cursor-pointer"
                aria-label="Music volume"
              />
            </div>
          </div>

          {snap.streamError && (
            <p className="mt-2 text-[11px] text-amber-300">{snap.streamError}</p>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => musicLibrary.setCategory('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              snap.selectedCategory === 'ALL'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            All Categories
          </button>
          {MUSIC_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => musicLibrary.setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                snap.selectedCategory === cat.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Playlist */}
        <div className="mt-3 flex-1 overflow-y-auto space-y-1.5 pr-1">
          {visibleTracks.map((track) => {
            const isCurrent = track.id === snap.activeTrack.id;
            const catMeta = MUSIC_CATEGORIES.find((c) => c.id === track.category);
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => {
                  if (isCurrent) {
                    musicLibrary.togglePlayPause();
                  } else {
                    musicLibrary.selectTrack(track.id, true);
                  }
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-cyan-500/15 border-cyan-400/50 text-white'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{track.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{catMeta?.label || track.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{track.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{track.bpm} BPM</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {track.sourceKind === 'LOCAL_FILE'
                        ? 'Local Audio'
                        : track.sourceKind === 'LICENSED_STREAM'
                        ? 'Licensed Stream'
                        : 'Studio Synth'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {formatClock(track.durationSec)}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isCurrent && snap.isPlaying
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-white/10 text-white'
                    }`}
                  >
                    {isCurrent && snap.isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Local Licensed Audio Import */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Import a personal audio file (MP3, WAV, OGG) into your driving playlist:
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as MusicCategory)}
              className="bg-slate-900 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white"
              aria-label="Category for uploaded track"
            >
              {MUSIC_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <label className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              <span>Load Audio</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
