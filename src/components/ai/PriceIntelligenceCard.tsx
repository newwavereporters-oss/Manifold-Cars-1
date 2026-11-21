import React, { useState } from 'react';
import {
  Sparkles,
  TrendingUp,
  AlertCircle,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  BarChart3,
} from 'lucide-react';
import { aiService, PriceIntelligenceResponse } from '../../services/aiService';

interface PriceIntelligenceCardProps {
  mode: 'dealer' | 'buyer';
  carId?: string;
  make: string;
  model: string;
  year?: number;
  trim?: string;
  condition?: string;
  mileage?: number;
  location?: string;
  askingPrice?: number;
}

export const PriceIntelligenceCard: React.FC<PriceIntelligenceCardProps> = ({
  mode,
  carId,
  make,
  model,
  year,
  trim,
  condition,
  mileage,
  location,
  askingPrice,
}) => {
  const [data, setData] = useState<PriceIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComps, setShowComps] = useState(false);

  const canAnalyze = Boolean(make.trim() && model.trim());

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      setError('Select a Brand / Make and Model before analyzing market pricing.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await aiService.getPriceIntelligence({
        carId,
        make: make.trim(),
        model: model.trim(),
        year,
        trim: trim?.trim() || undefined,
        condition: condition?.trim() || undefined,
        mileage,
        location: location?.trim() || undefined,
        askingPrice: askingPrice && askingPrice > 0 ? askingPrice : undefined,
        includeAiCommentary: true,
      });
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to compute price intelligence right now.');
    } finally {
      setLoading(false);
    }
  };

  const positioningBadge = (pos: PriceIntelligenceResponse['stats']['positioning']) => {
    switch (pos) {
      case 'below_market':
        return {
          label: 'Below Market Median',
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'competitive':
        return {
          label: 'Competitive Market Band',
          className: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'above_market':
        return {
          label: 'Above Market Median',
          className: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      default:
        return {
          label: 'Insufficient Comparables',
          className: 'bg-gray-100 text-gray-600 border-gray-200',
        };
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-slate-50/70 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#EF233C]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#071A2B]">
              {mode === 'dealer'
                ? 'Market Price Intelligence & Benchmarks'
                : 'MANIFOLD Fair Price Benchmark'}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Compares live MANIFOLD asking prices &amp; approved market observations without inventing unverified estimates.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !canAnalyze}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#071A2B] hover:bg-[#0B2239] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-[#EF233C]" />
              <span>{data ? 'Refresh Benchmark' : 'Check Market Benchmark'}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="space-y-4 pt-1">
          {data.aiWarning && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Showing deterministic statistical comparables ({data.aiWarning}).
              </span>
            </div>
          )}

          {data.stats.insufficientData ? (
            <div className="p-4 rounded-xl bg-white border border-gray-200 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                <Info className="w-4 h-4 text-amber-600" />
                <span>Insufficient Verified Comparables</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {data.stats.insufficiencyReason}
              </p>
              <p className="text-[11px] text-gray-400">
                MANIFOLD refuses to invent synthetic market bands when fewer than 2 verified comparables exist.
                {mode === 'dealer' ? ' Set your asking price using your dealership valuation.' : ''}
              </p>
            </div>
          ) : (
            <>
              {/* Summary Badges & Range Grid */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        positioningBadge(data.stats.positioning).className
                      }`}
                    >
                      {positioningBadge(data.stats.positioning).label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                      Confidence: {data.stats.confidence} ({data.stats.sampleCount} comps)
                    </span>
                  </div>

                  {data.stats.askingVsMedianPct !== null && (
                    <span className="text-xs font-extrabold text-[#071A2B]">
                      {data.stats.askingVsMedianPct > 0 ? '+' : ''}
                      {data.stats.askingVsMedianPct}% vs median
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">
                      Observed Min
                    </span>
                    <span className="font-bold text-gray-900 tabular-nums">
                      ₦{(data.stats.minPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">
                      Market Median
                    </span>
                    <span className="font-extrabold text-[#071A2B] tabular-nums">
                      ₦{(data.stats.medianPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">
                      Fair Market Band
                    </span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      ₦{Math.round((data.stats.recommendedRangeLow || 0) / 1_000_000)}M – ₦
                      {Math.round((data.stats.recommendedRangeHigh || 0) / 1_000_000)}M
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">
                      Observed Max
                    </span>
                    <span className="font-bold text-gray-900 tabular-nums">
                      ₦{(data.stats.maxPrice || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    <strong className="text-gray-700">{data.stats.internalAskingCount}</strong> MANIFOLD Asking Listings
                  </span>
                  <span>
                    <strong className="text-gray-700">{data.stats.externalObservationCount}</strong> Approved Market Observations
                  </span>
                  <span>
                    <strong className="text-gray-700">{data.stats.completedSalesCount}</strong> Completed Sales Records
                  </span>
                </div>
              </div>

              {/* Grounded AI Commentary */}
              {data.commentary && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#071A2B]">
                    <TrendingUp className="w-3.5 h-3.5 text-[#EF233C]" />
                    <span>{data.commentary.headlineSummary}</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{data.commentary.pricingRationale}</p>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-gray-700">
                    <strong className="text-[#071A2B]">
                      {mode === 'dealer' ? 'Dealer Positioning Note:' : 'Buyer Context:'}{' '}
                    </strong>
                    {mode === 'dealer'
                      ? data.commentary.dealerGuidance
                      : data.commentary.buyerTransparencyNote}
                  </div>
                </div>
              )}

              {/* Methodology & Expandable Comparable Sources */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{data.stats.methodologyNote}</span>
                  </span>
                  {data.stats.comparables.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowComps((s) => !s)}
                      className="shrink-0 font-bold text-[#071A2B] hover:text-[#EF233C] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showComps ? 'Hide Comps' : `View ${data.stats.comparables.length} Comps`}</span>
                      {showComps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {showComps && data.stats.comparables.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full text-left text-[11px] text-gray-600">
                      <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 border-b border-gray-200">
                        <tr>
                          <th className="py-2 px-3">Comparable Vehicle</th>
                          <th className="py-2 px-3">Condition / Location</th>
                          <th className="py-2 px-3">Source Attribution</th>
                          <th className="py-2 px-3 text-right">Asking Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.stats.comparables.map((comp) => (
                          <tr key={comp.id}>
                            <td className="py-2 px-3 font-semibold text-gray-900">{comp.label}</td>
                            <td className="py-2 px-3">
                              {comp.condition} · {comp.location}
                            </td>
                            <td className="py-2 px-3 text-gray-500">
                              {comp.sourceLabel} {comp.observedDate ? `(${comp.observedDate})` : ''}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900 tabular-nums">
                              ₦{comp.price.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
