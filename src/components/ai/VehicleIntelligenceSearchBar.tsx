import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Mic,
  Square,
  Search,
  Loader2,
  AlertCircle,
  X,
  Compass,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { aiService, RankedCarHit, VehicleSearchResponse } from '../../services/aiService';
import { Car } from '../../types';
import { VideoCarCard } from '../VideoCarCard';

interface VehicleIntelligenceSearchBarProps {
  initialQuery?: string;
  favorites: string[];
  onToggleFavorite: (carId: string) => void;
  onSelectCar: (car: Car) => void;
  onPlayVideo: (car: Car) => void;
  onInterested: (car: Car) => void;
  navigate: (route: string) => void;
}

const EXAMPLE_QUERIES = [
  'Tokunbo Lexus RX350 under 45M in Lekki',
  'Clean Toyota Camry automatic Lagos under 28M',
  'Executive 7-seater SUV Abuja',
];

export const VehicleIntelligenceSearchBar: React.FC<VehicleIntelligenceSearchBarProps> = ({
  initialQuery = '',
  favorites,
  onToggleFavorite,
  onSelectCar,
  onPlayVideo,
  onInterested,
  navigate,
}) => {
  const [queryText, setQueryText] = useState(initialQuery);
  const [searching, setSearching] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [editableTranscriptMode, setEditableTranscriptMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<VehicleSearchResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopRecordingTracks = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopRecordingTracks();
    };
  }, []);

  const executeAiSearch = async (query: string, mode: 'text' | 'voice' = 'text') => {
    const clean = query.trim();
    if (clean.length < 2) {
      setError('Describe what vehicle you want (make, budget, body type, or location).');
      return;
    }
    setSearching(true);
    setError(null);
    setEditableTranscriptMode(false);
    try {
      const res = await aiService.searchVehicles(clean, mode, 24);
      setSearchResult(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to run AI vehicle search right now.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) {
      setQueryText(initialQuery);
      void executeAiSearch(initialQuery, 'text');
    }
  }, [initialQuery]);

  const startVoiceCapture = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Microphone voice recording is not supported in this browser. Type your search query instead.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      const chosenMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stopRecordingTracks();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];

        if (blob.size < 400) {
          setError('Voice clip was too short. Hold or speak clearly and try again.');
          return;
        }
        if (blob.size > 4 * 1024 * 1024) {
          setError('Voice recording exceeded 4 MB limit. Please keep voice searches under 50 seconds.');
          return;
        }

        setTranscribing(true);
        try {
          const ext = (recorder.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
          const res = await aiService.transcribeVoiceAudio(blob, `voice-search.${ext}`);
          if (res.transcript) {
            setQueryText(res.transcript);
            setEditableTranscriptMode(true);
          } else {
            setError('Could not detect speech in audio clip. Please try again or type your search.');
          }
        } catch (err: any) {
          setError(err?.message || 'Voice transcription failed. You can still type your search below.');
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);

      timerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          if (prev + 1 >= 55) {
            recorder.stop();
            return 55;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      stopRecordingTracks();
      setRecording(false);
      setError('Microphone permission was denied or unavailable. Type your natural-language query below instead.');
    }
  };

  const stopVoiceCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCarClick = (hit: RankedCarHit, action: 'select' | 'video' | 'interest') => {
    if (searchResult?.analyticsId) {
      void aiService.trackSearchEvent(
        searchResult.analyticsId,
        hit.car.id,
        action === 'interest' ? true : undefined
      );
    }
    if (action === 'select') onSelectCar(hit.car);
    else if (action === 'video') onPlayVideo(hit.car);
    else onInterested(hit.car);
  };

  const clearAiSearch = () => {
    setSearchResult(null);
    setQueryText('');
    setEditableTranscriptMode(false);
    setError(null);
  };

  const parsedChips: string[] = [];
  if (searchResult?.parsedIntent) {
    const p = searchResult.parsedIntent;
    if (p.make) parsedChips.push(`Make: ${p.make}`);
    if (p.model) parsedChips.push(`Model: ${p.model}`);
    if (p.bodyType) parsedChips.push(`Type: ${p.bodyType}`);
    if (p.condition) parsedChips.push(p.condition);
    if (p.location) parsedChips.push(`Location: ${p.location}`);
    if (p.maxPriceNgn) parsedChips.push(`Max ₦${(p.maxPriceNgn / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`);
    if (p.yearMin) parsedChips.push(`${p.yearMin}+`);
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="bg-gradient-to-r from-[#071A2B] via-[#0B2239] to-[#071A2B] rounded-2xl p-4 sm:p-5 text-white border border-white/10 shadow-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EF233C]" />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              MANIFOLD Vehicle Intelligence Search
            </span>
          </div>
          <span className="text-[11px] text-gray-300">
            Natural language &amp; Nigerian voice search across verified live inventory
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executeAiSearch(queryText, editableTranscriptMode ? 'voice' : 'text');
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder='Try: "Tokunbo Lexus RX350 under 45M in Lekki" or tap the mic...'
              className="w-full h-11 pl-10 pr-9 bg-white text-gray-900 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-[#EF233C]"
            />
            {queryText && (
              <button
                type="button"
                onClick={clearAiSearch}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-700"
                title="Clear AI search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {recording ? (
              <button
                type="button"
                onClick={stopVoiceCapture}
                className="h-11 px-4 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 animate-pulse cursor-pointer shrink-0"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop ({recordSeconds}s)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceCapture}
                disabled={transcribing || searching}
                title="Search by voice"
                className="h-11 px-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-50"
              >
                {transcribing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#EF233C]" />
                    <span>Transcribing...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-[#EF233C]" />
                    <span className="hidden sm:inline">Voice</span>
                  </>
                )}
              </button>
            )}

            <button
              type="submit"
              disabled={searching || transcribing}
              className="h-11 px-5 bg-[#EF233C] hover:bg-[#d91b32] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 transition cursor-pointer shrink-0"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>AI Search</span>
            </button>
          </div>
        </form>

        {editableTranscriptMode && (
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-400/30 flex items-center justify-between gap-2 text-xs text-emerald-100">
            <span>Voice transcript ready — edit the query above if needed, then click <strong>AI Search</strong>.</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-gray-400">Try:</span>
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQueryText(example);
                void executeAiSearch(example, 'text');
              }}
              className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 transition cursor-pointer"
            >
              {example}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-400/40 flex items-start gap-2 text-xs text-red-100">
            <AlertCircle className="w-4 h-4 text-[#EF233C] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* AI Search Ranked Results Panel */}
      {searchResult && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#071A2B]">
                  Intelligent Search Results ({searchResult.exactMatches.length} exact ·{' '}
                  {searchResult.strongMatches.length} strong · {searchResult.alternatives.length} close)
                </span>
              </div>
              <p className="text-xs text-gray-600">{searchResult.parsedIntent.intentSummary}</p>
            </div>

            <button
              type="button"
              onClick={clearAiSearch}
              className="text-xs font-bold text-[#EF233C] hover:underline self-start sm:self-center cursor-pointer"
            >
              Exit AI Search View
            </button>
          </div>

          {parsedChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-gray-400 mr-1">Understood criteria:</span>
              {parsedChips.map((chip) => (
                <span
                  key={chip}
                  className="px-2.5 py-0.5 rounded-full bg-slate-100 text-[#071A2B] font-semibold"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          {searchResult.noExactMatchMessage && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{searchResult.noExactMatchMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/car-hunt')}
                className="shrink-0 px-4 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase rounded-lg cursor-pointer"
              >
                Request Car Hunt →
              </button>
            </div>
          )}

          {searchResult.exactMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                Exact Matches ({searchResult.exactMatches.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {searchResult.exactMatches.map((hit) => (
                  <div key={hit.car.id} className="space-y-2">
                    <VideoCarCard
                      car={hit.car}
                      isFavorite={favorites.includes(hit.car.id)}
                      onToggleFavorite={onToggleFavorite}
                      onSelectCar={() => handleCarClick(hit, 'select')}
                      onPlayVideo={() => handleCarClick(hit, 'video')}
                      onInterested={() => handleCarClick(hit, 'interest')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResult.strongMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#071A2B]">
                Strong Matches ({searchResult.strongMatches.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {searchResult.strongMatches.map((hit) => (
                  <div key={hit.car.id} className="space-y-2">
                    <VideoCarCard
                      car={hit.car}
                      isFavorite={favorites.includes(hit.car.id)}
                      onToggleFavorite={onToggleFavorite}
                      onSelectCar={() => handleCarClick(hit, 'select')}
                      onPlayVideo={() => handleCarClick(hit, 'video')}
                      onInterested={() => handleCarClick(hit, 'interest')}
                    />
                    {hit.disclosedDifferences.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                        <strong>Difference:</strong> {hit.disclosedDifferences.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResult.alternatives.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-600">
                Closest Verified Alternatives (With Disclosed Differences)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {searchResult.alternatives.map((hit) => (
                  <div key={hit.car.id} className="space-y-2">
                    <VideoCarCard
                      car={hit.car}
                      isFavorite={favorites.includes(hit.car.id)}
                      onToggleFavorite={onToggleFavorite}
                      onSelectCar={() => handleCarClick(hit, 'select')}
                      onPlayVideo={() => handleCarClick(hit, 'video')}
                      onInterested={() => handleCarClick(hit, 'interest')}
                    />
                    {hit.disclosedDifferences.length > 0 && (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                        <strong>Difference:</strong> {hit.disclosedDifferences.join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResult.exactMatches.length === 0 &&
            searchResult.strongMatches.length === 0 &&
            searchResult.alternatives.length === 0 && (
              <div className="text-center py-6 space-y-3">
                <Compass className="w-10 h-10 text-[#EF233C] mx-auto" />
                <p className="text-sm font-bold text-gray-900">
                  No live inventory matched those exact requirements.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/car-hunt')}
                  className="px-5 py-2.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                >
                  Start a Managed Car Hunt
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
};
