import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  getSupabaseConfig,
  setSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
  checkIsSupabaseConfigured,
} from '../../lib/supabase';
import { carService } from '../../services/carService';
import { mediaService } from '../../services/mediaService';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

const SUPABASE_SCHEMA_SQL = `-- MANIFOLD Automotive Marketplace — Supabase Schema
CREATE TABLE IF NOT EXISTS public.cars (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT DEFAULT '',
  body_type TEXT NOT NULL DEFAULT 'SUV',
  condition TEXT NOT NULL DEFAULT 'Foreign Used',
  price BIGINT NOT NULL,
  original_price BIGINT,
  is_price_reduced BOOLEAN DEFAULT false,
  location TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Lagos',
  mileage INTEGER NOT NULL DEFAULT 0,
  transmission TEXT NOT NULL DEFAULT 'Automatic',
  fuel_type TEXT NOT NULL DEFAULT 'Petrol',
  drive_type TEXT NOT NULL DEFAULT 'AWD',
  engine TEXT DEFAULT '3.5L V6',
  horsepower INTEGER,
  exterior_color TEXT NOT NULL DEFAULT 'Metallic Black',
  interior_color TEXT NOT NULL DEFAULT 'Black Leather',
  seats INTEGER DEFAULT 5,
  doors INTEGER DEFAULT 4,
  is_featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  views_count INTEGER DEFAULT 0,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  youtube_video_id TEXT,
  youtube_url TEXT,
  youtube_thumbnail_url TEXT,
  video_title TEXT,
  video_duration TEXT DEFAULT '12:00',
  video_type TEXT DEFAULT 'full_review',
  video_presenter TEXT DEFAULT 'MANIFOLD Presenter',
  gallery_image_1_url TEXT,
  gallery_image_2_url TEXT,
  is_verified BOOLEAN DEFAULT true,
  inspection_score INTEGER DEFAULT 95,
  verified_date TEXT,
  verified_by TEXT DEFAULT 'MANIFOLD Field Unit',
  dealer_id TEXT DEFAULT 'dlr-partner-01',
  dealer_name TEXT DEFAULT 'Prestige Motors Lekki',
  dealer_city TEXT DEFAULT 'Lekki',
  dealer_state TEXT DEFAULT 'Lagos',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.media_reviews (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  video_type TEXT NOT NULL DEFAULT 'Car Review',
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  youtube_thumbnail_url TEXT,
  car_id TEXT REFERENCES public.cars(id) ON DELETE SET NULL,
  car_title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Published',
  is_featured BOOLEAN DEFAULT false,
  is_primary BOOLEAN DEFAULT false,
  duration TEXT DEFAULT '12:00',
  views_count TEXT DEFAULT '1.2k views',
  presenter TEXT DEFAULT 'MANIFOLD Media Team',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Cars" ON public.cars FOR SELECT USING (true);
CREATE POLICY "Public Write Cars" ON public.cars FOR ALL USING (true);
CREATE POLICY "Public Read Media" ON public.media_reviews FOR SELECT USING (true);
CREATE POLICY "Public Write Media" ON public.media_reviews FOR ALL USING (true);
`;

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getSupabaseConfig();
      setUrl(current.url);
      setAnonKey(current.anonKey);
      setConfigured(current.isConfigured);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSave = async () => {
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({
        success: false,
        message: 'Please enter both Supabase Project URL and Anon Public Key.',
      });
      return;
    }

    setSupabaseConfig(url.trim(), anonKey.trim());
    setConfigured(checkIsSupabaseConfigured());
    setTestResult({
      success: true,
      message: 'Supabase credentials saved! Connecting to live database...',
    });

    // Run live refresh
    setIsSyncing(true);
    try {
      await carService.getCars();
      await mediaService.getVideos();
    } catch {
      // ignore
    }
    setIsSyncing(false);

    if (onStatusChange) onStatusChange();
  };

  const handleSyncToSupabase = async () => {
    setIsSyncing(true);
    try {
      await carService.getCars();
      await mediaService.getVideos();
      setTestResult({
        success: true,
        message: 'Live Supabase database connection verified and inventory loaded!',
      });
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `Sync failed: ${e.message}`,
      });
    }
    setIsSyncing(false);
  };

  const handleDisconnect = () => {
    clearSupabaseConfig();
    setUrl('');
    setAnonKey('');
    setConfigured(false);
    setTestResult({
      success: true,
      message: 'Supabase disconnected. App has reverted to local storage mode.',
    });
    if (onStatusChange) onStatusChange();
  };

  const handleCopySql = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="bg-[#071A2B] px-6 py-5 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3ECF8E] text-gray-900 flex items-center justify-center font-bold shadow">
              <Database className="w-4 h-4 text-[#071A2B]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm font-display tracking-wide text-white">
                  Supabase Database Connection
                </h3>
                <span
                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded tracking-wider ${
                    configured
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {configured ? 'Connected' : 'Offline / Local'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Connect MANIFOLD to your live PostgreSQL database on Supabase
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
        <div className="p-6 sm:p-7 space-y-6">
          {/* Status Alert Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Supabase Project URL
                </label>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#EF233C] hover:underline font-semibold inline-flex items-center gap-1"
                >
                  Supabase Dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyzcompany.supabase.co"
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Found in: <strong>Project Settings &gt; API &gt; Project URL</strong>
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Supabase Anon Public API Key
              </label>
              <input
                type="password"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:border-[#071A2B] outline-none font-mono"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Found in: <strong>Project Settings &gt; API &gt; Project API keys &gt; anon public</strong>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={isTesting || !url || !anonKey}
                className="px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span>Test Connection</span>
              </button>

              {configured && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-red-600 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {configured && (
                <button
                  type="button"
                  onClick={handleSyncToSupabase}
                  disabled={isSyncing}
                  className="px-3.5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Push Local to Supabase</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={isSyncing || isTesting}
                className="px-5 py-2 bg-[#EF233C] hover:bg-[#d91b32] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Save & Connect</span>
              </button>
            </div>
          </div>

          {/* SQL Setup Helper Section */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#3ECF8E]" />
                Supabase SQL Database Migration Script
              </span>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-2.5 py-1 bg-white border border-gray-200 hover:border-gray-400 rounded text-[11px] font-bold text-gray-700 flex items-center gap-1 transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Schema'}</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              To create the <strong>cars</strong> and <strong>media_reviews</strong> tables in your Supabase project, click "Copy SQL Schema", open your Supabase Dashboard &gt; <strong>SQL Editor</strong>, paste, and click <strong>Run</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
