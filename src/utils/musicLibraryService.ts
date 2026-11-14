// MANIFOLD WORLD - PERSISTENT MUSIC LIBRARY SERVICE
// Supports:
//   1. Built-in category-tuned Web Audio API polyphonic studio grooves (zero external dependencies)
//   2. Operator-configured licensed audio streams via VITE_MUSIC_MANIFEST_JSON
//   3. Player-uploaded local audio files (MP3/WAV/OGG) or verified audio stream URLs
// Maintains a single persistent player instance across HUD / camera transitions without blocking driving input.

export type MusicCategory =
  | 'AFROBEATS'
  | 'ELECTRONIC'
  | 'HIP_HOP'
  | 'CHILL'
  | 'RACING'
  | 'AMBIENT';

export interface MusicCategoryMeta {
  id: MusicCategory;
  label: string;
  description: string;
  accentHex: string;
}

export const MUSIC_CATEGORIES: MusicCategoryMeta[] = [
  {
    id: 'AFROBEATS',
    label: 'Afrobeats',
    description: 'Lagos log-drum & syncopated sunset bounce',
    accentHex: '#F59E0B',
  },
  {
    id: 'ELECTRONIC',
    label: 'Electronic',
    description: 'Progressive house & neon arpeggios',
    accentHex: '#06B6D4',
  },
  {
    id: 'HIP_HOP',
    label: 'Hip-Hop',
    description: 'Sub-bass 808 bounce & crisp snare pocket',
    accentHex: '#EF233C',
  },
  {
    id: 'CHILL',
    label: 'Chill',
    description: 'Warm Rhodes chords & coastal lo-fi',
    accentHex: '#10B981',
  },
  {
    id: 'RACING',
    label: 'High-Energy Racing',
    description: 'Fast 140+ BPM overdrive synth momentum',
    accentHex: '#F97316',
  },
  {
    id: 'AMBIENT',
    label: 'Ambient',
    description: 'Lush atmospheric pads for late-night cruising',
    accentHex: '#8B5CF6',
  },
];

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  category: MusicCategory;
  bpm: number;
  durationSec: number;
  sourceKind: 'STUDIO_SYNTH' | 'LICENSED_STREAM' | 'LOCAL_FILE';
  audioUrl?: string;
  chordRoots: number[]; // MIDI root notes used by studio synth fallback
  bassPattern: number[]; // 16-step offsets (0 = rest, >0 = semitone delta)
  leadPattern: number[]; // 16-step melody scale offsets (-1 = rest)
}

const BUILTIN_TRACKS: MusicTrack[] = [
  {
    id: 'afro-lagos-sunset',
    title: 'Eko Sunset Log-Drum',
    artist: 'Manifold Studio Session',
    category: 'AFROBEATS',
    bpm: 112,
    durationSec: 204,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [48, 53, 55, 50],
    bassPattern: [0, -1, 0, 7, -1, 0, -1, 5, 0, -1, 7, -1, 3, -1, 5, -1],
    leadPattern: [12, -1, 15, 19, -1, 17, 15, -1, 12, -1, 14, 15, -1, 19, 17, 15],
  },
  {
    id: 'afro-ikoyi-cruise',
    title: 'Ikoyi Golden Hour',
    artist: 'Manifold Studio Session',
    category: 'AFROBEATS',
    bpm: 106,
    durationSec: 218,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [45, 50, 52, 48],
    bassPattern: [0, -1, -1, 7, 0, -1, 5, -1, 0, -1, -1, 7, 3, -1, 5, -1],
    leadPattern: [12, 14, -1, 17, 19, -1, 17, 14, 12, -1, 15, 14, -1, 12, 10, -1],
  },
  {
    id: 'elec-third-mainland',
    title: 'Third Mainland Pulse',
    artist: 'Manifold Studio Session',
    category: 'ELECTRONIC',
    bpm: 126,
    durationSec: 196,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [45, 48, 53, 52],
    bassPattern: [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 7, 12],
    leadPattern: [12, 15, 19, 24, 19, 15, 12, 19, 12, 15, 19, 22, 19, 15, 14, 15],
  },
  {
    id: 'elec-vi-neon',
    title: 'Victoria Island Skyline',
    artist: 'Manifold Studio Session',
    category: 'ELECTRONIC',
    bpm: 124,
    durationSec: 212,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [43, 48, 50, 46],
    bassPattern: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 0, 12, 5, 7],
    leadPattern: [19, -1, 17, 15, 19, -1, 22, 19, 17, -1, 15, 14, 15, -1, 17, -1],
  },
  {
    id: 'hiphop-surulere-808',
    title: 'Surulere Midnight 808',
    artist: 'Manifold Studio Session',
    category: 'HIP_HOP',
    bpm: 92,
    durationSec: 190,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [41, 41, 44, 43],
    bassPattern: [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, -1, 5, -1, 3, -1, -1],
    leadPattern: [15, -1, -1, 19, -1, 17, -1, 15, 14, -1, 12, -1, -1, 15, -1, -1],
  },
  {
    id: 'hiphop-mainland-bounce',
    title: 'Mainland Heavy Pocket',
    artist: 'Manifold Studio Session',
    category: 'HIP_HOP',
    bpm: 96,
    durationSec: 184,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [43, 46, 48, 45],
    bassPattern: [0, -1, 0, -1, -1, 7, -1, 0, -1, 0, -1, 5, 3, -1, -1, -1],
    leadPattern: [12, -1, 15, -1, 19, -1, 17, 15, -1, 12, -1, 14, -1, 15, -1, -1],
  },
  {
    id: 'chill-lekki-breeze',
    title: 'Lekki Coastal Rhodes',
    artist: 'Manifold Studio Session',
    category: 'CHILL',
    bpm: 84,
    durationSec: 230,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [48, 45, 50, 43],
    bassPattern: [0, -1, -1, -1, 7, -1, -1, -1, 0, -1, -1, -1, 5, -1, 7, -1],
    leadPattern: [16, -1, 19, -1, 21, -1, 19, 16, 14, -1, 16, -1, -1, -1, 12, -1],
  },
  {
    id: 'chill-lagoon-lounge',
    title: 'Marina Lagoon Breeze',
    artist: 'Manifold Studio Session',
    category: 'CHILL',
    bpm: 88,
    durationSec: 222,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [46, 51, 48, 43],
    bassPattern: [0, -1, -1, 5, -1, -1, 7, -1, 0, -1, -1, 3, -1, -1, 5, -1],
    leadPattern: [14, -1, 17, 19, -1, 17, 14, -1, 12, -1, 14, 15, -1, -1, 12, -1],
  },
  {
    id: 'race-turbo-apex',
    title: 'Turbo Redline Sprint',
    artist: 'Manifold Studio Session',
    category: 'RACING',
    bpm: 146,
    durationSec: 178,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [40, 43, 45, 47],
    bassPattern: [0, 0, 0, 12, 0, 0, 7, 12, 0, 0, 0, 12, 0, 7, 10, 12],
    leadPattern: [12, 15, 19, 15, 24, 19, 15, 12, 14, 17, 21, 17, 24, 21, 19, 17],
  },
  {
    id: 'race-epe-overdrive',
    title: 'Epe Highway Overdrive',
    artist: 'Manifold Studio Session',
    category: 'RACING',
    bpm: 152,
    durationSec: 174,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [45, 48, 50, 52],
    bassPattern: [0, 12, 0, 12, 0, 12, 7, 12, 0, 12, 0, 12, 5, 7, 10, 12],
    leadPattern: [19, 22, 24, 22, 19, 17, 19, 24, 19, 22, 26, 24, 22, 19, 17, 15],
  },
  {
    id: 'ambient-night-skyline',
    title: 'Midnight Lagoon Horizon',
    artist: 'Manifold Studio Session',
    category: 'AMBIENT',
    bpm: 72,
    durationSec: 260,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [48, 44, 46, 43],
    bassPattern: [0, -1, -1, -1, -1, -1, 7, -1, 0, -1, -1, -1, -1, -1, 5, -1],
    leadPattern: [19, -1, -1, 24, -1, -1, 22, -1, 19, -1, -1, 15, -1, -1, 14, -1],
  },
  {
    id: 'ambient-lasu-mist',
    title: 'Atlantic Mist Drift',
    artist: 'Manifold Studio Session',
    category: 'AMBIENT',
    bpm: 76,
    durationSec: 252,
    sourceKind: 'STUDIO_SYNTH',
    chordRoots: [45, 50, 48, 43],
    bassPattern: [0, -1, -1, -1, 7, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1],
    leadPattern: [24, -1, 21, -1, 19, -1, -1, 16, 19, -1, 14, -1, -1, 12, -1, -1],
  },
];

function loadConfiguredManifestTracks(): MusicTrack[] {
  try {
    const raw =
      typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_MUSIC_MANIFEST_JSON as string | undefined) : undefined;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: MusicTrack[] = [];
    for (const item of parsed) {
      if (item && typeof item.title === 'string' && typeof item.audioUrl === 'string' && item.audioUrl.startsWith('http')) {
        const cat: MusicCategory = MUSIC_CATEGORIES.some((c) => c.id === item.category)
          ? item.category
          : 'AFROBEATS';
        out.push({
          id: String(item.id || `ext-${out.length + 1}`),
          title: item.title,
          artist: String(item.artist || 'Licensed Stream'),
          category: cat,
          bpm: Number(item.bpm) || 110,
          durationSec: Number(item.durationSec) || 180,
          sourceKind: 'LICENSED_STREAM',
          audioUrl: item.audioUrl,
          chordRoots: [48, 53, 55, 50],
          bassPattern: [0, -1, 0, -1, 0, -1, 7, -1, 0, -1, 0, -1, 5, -1, 7, -1],
          leadPattern: [12, -1, 15, -1, 19, -1, 17, -1, 12, -1, 14, -1, 15, -1, 19, -1],
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export interface MusicPlayerSnapshot {
  tracks: MusicTrack[];
  activeTrack: MusicTrack;
  selectedCategory: MusicCategory | 'ALL';
  isPlaying: boolean;
  isMuted: boolean;
  volume: number; // 0..1
  elapsedSec: number;
  streamError: string | null;
}

class ManifoldMusicLibraryService {
  private tracks: MusicTrack[] = [...loadConfiguredManifestTracks(), ...BUILTIN_TRACKS];
  private activeTrackId: string = this.tracks[0].id;
  private selectedCategory: MusicCategory | 'ALL' = 'ALL';
  private isPlaying: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.65;
  private elapsedSec: number = 0;
  private streamError: string | null = null;

  private listeners = new Set<(snap: MusicPlayerSnapshot) => void>();

  // HTML5 Audio element for external licensed URLs or uploaded local audio files
  private htmlAudio: HTMLAudioElement | null = null;

  // Dedicated Web Audio API synthesizer nodes for built-in grooves
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private stepTimer: number | null = null;
  private progressTimer: number | null = null;
  private stepIdx: number = 0;

  private getFilteredList(): MusicTrack[] {
    if (this.selectedCategory === 'ALL') return this.tracks;
    const filtered = this.tracks.filter((t) => t.category === this.selectedCategory);
    return filtered.length > 0 ? filtered : this.tracks;
  }

  public getActiveTrack(): MusicTrack {
    return this.tracks.find((t) => t.id === this.activeTrackId) || this.tracks[0];
  }

  public getSnapshot(): MusicPlayerSnapshot {
    return {
      tracks: this.tracks,
      activeTrack: this.getActiveTrack(),
      selectedCategory: this.selectedCategory,
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
      elapsedSec: Math.floor(this.elapsedSec),
      streamError: this.streamError,
    };
  }

  public subscribe(listener: (snap: MusicPlayerSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private ensureAudioContext() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume * 0.24, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private ensureHtmlAudio() {
    if (typeof window === 'undefined') return;
    if (!this.htmlAudio) {
      this.htmlAudio = new Audio();
      this.htmlAudio.crossOrigin = 'anonymous';
      this.htmlAudio.addEventListener('ended', () => {
        this.nextTrack();
      });
      this.htmlAudio.addEventListener('timeupdate', () => {
        if (this.htmlAudio && !Number.isNaN(this.htmlAudio.currentTime)) {
          this.elapsedSec = this.htmlAudio.currentTime;
          this.emit();
        }
      });
      this.htmlAudio.addEventListener('error', () => {
        this.streamError = 'Unable to load audio stream; switched to studio synthesizer playback.';
        const current = this.getActiveTrack();
        current.audioUrl = undefined;
        current.sourceKind = 'STUDIO_SYNTH';
        if (this.isPlaying) {
          this.startSynthPlayback();
        }
        this.emit();
      });
    }
    this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
  }

  private stopTransportOnly() {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    if (this.htmlAudio) {
      this.htmlAudio.pause();
    }
  }

  private midiToHz(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private triggerSynthStep() {
    if (!this.isPlaying || !this.ctx || !this.masterGain || this.isMuted) return;
    const track = this.getActiveTrack();
    const now = this.ctx.currentTime;
    const step = this.stepIdx % 16;
    const bar = Math.floor(this.stepIdx / 16) % track.chordRoots.length;
    const rootMidi = track.chordRoots[bar];
    const stepDurSec = Math.max(0.08, 60 / track.bpm / 4);

    // 1. Kick drum (4-on-floor or Afrobeats/Hip-Hop pocket)
    const kickHits =
      track.category === 'HIP_HOP'
        ? [0, 6, 10]
        : track.category === 'AFROBEATS'
        ? [0, 3, 6, 10, 12]
        : track.category === 'AMBIENT'
        ? [0]
        : [0, 4, 8, 12];

    if (kickHits.includes(step)) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(track.category === 'HIP_HOP' ? 92 : 118, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
      kickGain.gain.setValueAtTime(0.45, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      kickOsc.connect(kickGain);
      kickGain.connect(this.masterGain);
      kickOsc.start(now);
      kickOsc.stop(now + 0.17);
    }

    // 2. Snare / Rimshot clap
    const snareHits =
      track.category === 'AFROBEATS'
        ? [4, 11, 14]
        : track.category === 'AMBIENT'
        ? []
        : [4, 12];
    if (snareHits.includes(step)) {
      const rimOsc = this.ctx.createOscillator();
      const rimGain = this.ctx.createGain();
      rimOsc.type = track.category === 'AFROBEATS' ? 'triangle' : 'square';
      rimOsc.frequency.setValueAtTime(track.category === 'AFROBEATS' ? 540 : 210, now);
      rimOsc.frequency.exponentialRampToValueAtTime(110, now + 0.07);
      rimGain.gain.setValueAtTime(0.18, now);
      rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      rimOsc.connect(rimGain);
      rimGain.connect(this.masterGain);
      rimOsc.start(now);
      rimOsc.stop(now + 0.085);
    }

    // 3. Hi-hat pulse
    if (track.category !== 'AMBIENT' && step % 2 === 1) {
      const hatOsc = this.ctx.createOscillator();
      const hatGain = this.ctx.createGain();
      hatOsc.type = 'highpass' in hatOsc ? 'square' : 'square';
      hatOsc.frequency.setValueAtTime(6200, now);
      hatGain.gain.setValueAtTime(0.04, now);
      hatGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.035);
      hatOsc.connect(hatGain);
      hatGain.connect(this.masterGain);
      hatOsc.start(now);
      hatOsc.stop(now + 0.04);
    }

    // 4. Bassline / Log drum
    const bassOffset = track.bassPattern[step];
    if (bassOffset >= 0) {
      const bassOsc = this.ctx.createOscillator();
      const bassFilter = this.ctx.createBiquadFilter();
      const bassGain = this.ctx.createGain();
      bassOsc.type = track.category === 'RACING' || track.category === 'ELECTRONIC' ? 'sawtooth' : 'triangle';
      bassOsc.frequency.setValueAtTime(this.midiToHz(rootMidi - 12 + bassOffset), now);
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(track.category === 'RACING' ? 680 : 380, now);
      bassGain.gain.setValueAtTime(0.28, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepDurSec * 1.4);
      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.masterGain);
      bassOsc.start(now);
      bassOsc.stop(now + stepDurSec * 1.45);
    }

    // 5. Chord pad stab on bar start / beat 1 & 9
    if (step === 0 || (track.category === 'CHILL' && step === 8)) {
      [0, 3, 7].forEach((interval) => {
        if (!this.ctx || !this.masterGain) return;
        const padOsc = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        padOsc.type = track.category === 'CHILL' || track.category === 'AMBIENT' ? 'sine' : 'triangle';
        padOsc.frequency.setValueAtTime(this.midiToHz(rootMidi + 12 + interval), now);
        const holdSec = track.category === 'AMBIENT' ? stepDurSec * 14 : stepDurSec * 6;
        padGain.gain.setValueAtTime(0.001, now);
        padGain.gain.linearRampToValueAtTime(0.065, now + 0.03);
        padGain.gain.exponentialRampToValueAtTime(0.0008, now + holdSec);
        padOsc.connect(padGain);
        padGain.connect(this.masterGain);
        padOsc.start(now);
        padOsc.stop(now + holdSec + 0.02);
      });
    }

    // 6. Melodic lead / pluck
    const leadOffset = track.leadPattern[step];
    if (leadOffset >= 0) {
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type =
        track.category === 'ELECTRONIC' || track.category === 'RACING'
          ? 'sawtooth'
          : track.category === 'AMBIENT'
          ? 'sine'
          : 'triangle';
      leadOsc.frequency.setValueAtTime(this.midiToHz(rootMidi + leadOffset), now);
      leadGain.gain.setValueAtTime(0.11, now);
      leadGain.gain.exponentialRampToValueAtTime(0.0008, now + stepDurSec * 1.6);
      leadOsc.connect(leadGain);
      leadGain.connect(this.masterGain);
      leadOsc.start(now);
      leadOsc.stop(now + stepDurSec * 1.65);
    }

    this.stepIdx = (this.stepIdx + 1) % (16 * track.chordRoots.length);
  }

  private startSynthPlayback() {
    this.stopTransportOnly();
    this.ensureAudioContext();
    const track = this.getActiveTrack();
    const stepMs = Math.max(85, Math.round((60 / track.bpm / 4) * 1000));
    this.stepTimer = window.setInterval(() => {
      this.triggerSynthStep();
    }, stepMs);
    this.progressTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.elapsedSec += 1;
      if (this.elapsedSec >= track.durationSec) {
        this.nextTrack();
      } else {
        this.emit();
      }
    }, 1000);
    this.triggerSynthStep();
  }

  private startCurrentTrackTransport() {
    const track = this.getActiveTrack();
    this.streamError = null;
    if (track.audioUrl) {
      this.stopTransportOnly();
      this.ensureHtmlAudio();
      if (this.htmlAudio) {
        if (this.htmlAudio.src !== track.audioUrl) {
          this.htmlAudio.src = track.audioUrl;
        }
        this.htmlAudio.currentTime = this.elapsedSec;
        this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
        this.htmlAudio.play().catch(() => {
          this.streamError = 'External stream blocked by browser/CORS; falling back to Studio Synth.';
          this.startSynthPlayback();
          this.emit();
        });
      }
    } else {
      this.startSynthPlayback();
    }
  }

  public play() {
    this.isPlaying = true;
    this.startCurrentTrackTransport();
    this.emit();
  }

  public pause() {
    this.isPlaying = false;
    this.stopTransportOnly();
    this.emit();
  }

  public togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public selectTrack(trackId: string, autoplay = true) {
    const found = this.tracks.find((t) => t.id === trackId);
    if (!found) return;
    this.activeTrackId = found.id;
    this.elapsedSec = 0;
    this.stepIdx = 0;
    if (autoplay) {
      this.isPlaying = true;
      this.startCurrentTrackTransport();
    } else if (this.isPlaying) {
      this.startCurrentTrackTransport();
    }
    this.emit();
  }

  public nextTrack() {
    const list = this.getFilteredList();
    const idx = list.findIndex((t) => t.id === this.activeTrackId);
    const next = list[(idx + 1) % list.length];
    this.selectTrack(next.id, this.isPlaying);
  }

  public prevTrack() {
    const list = this.getFilteredList();
    const idx = list.findIndex((t) => t.id === this.activeTrackId);
    const prev = list[(idx - 1 + list.length) % list.length];
    this.selectTrack(prev.id, this.isPlaying);
  }

  public setCategory(category: MusicCategory | 'ALL') {
    this.selectedCategory = category;
    const filtered = this.getFilteredList();
    if (!filtered.some((t) => t.id === this.activeTrackId) && filtered.length > 0) {
      this.selectTrack(filtered[0].id, this.isPlaying);
      return;
    }
    this.emit();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume * 0.24, this.ctx.currentTime, 0.04);
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.emit();
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.volume * 0.24, this.ctx.currentTime, 0.04);
    }
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.emit();
  }

  public addCustomLocalOrUrlTrack(opts: {
    title: string;
    artist?: string;
    category: MusicCategory;
    audioUrl: string;
    sourceKind: 'LICENSED_STREAM' | 'LOCAL_FILE';
  }): MusicTrack {
    const newTrack: MusicTrack = {
      id: `custom-${Date.now()}`,
      title: opts.title.trim() || 'Custom Audio Track',
      artist: (opts.artist || '').trim() || (opts.sourceKind === 'LOCAL_FILE' ? 'Local File' : 'Custom Stream'),
      category: opts.category,
      bpm: 115,
      durationSec: 210,
      sourceKind: opts.sourceKind,
      audioUrl: opts.audioUrl,
      chordRoots: [48, 53, 55, 50],
      bassPattern: [0, -1, 0, -1, 0, -1, 7, -1, 0, -1, 0, -1, 5, -1, 7, -1],
      leadPattern: [12, -1, 15, -1, 19, -1, 17, -1, 12, -1, 14, -1, 15, -1, 19, -1],
    };
    this.tracks = [newTrack, ...this.tracks];
    this.selectTrack(newTrack.id, true);
    return newTrack;
  }
}

export const musicLibrary = new ManifoldMusicLibraryService();
