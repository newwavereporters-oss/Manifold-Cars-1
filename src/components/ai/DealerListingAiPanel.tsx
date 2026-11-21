import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Wand2,
  ShieldCheck,
  ArrowDownToLine,
} from 'lucide-react';
import {
  aiService,
  ListingActionType,
  ListingApproach,
  ListingCallToAction,
  ListingCopyResponse,
  ListingLength,
  ListingSellingAngle,
  ListingTargetBuyer,
  ListingTone,
} from '../../services/aiService';

interface DealerListingAiPanelProps {
  carId?: string;
  make: string;
  model: string;
  trim?: string;
  year?: number;
  bodyType?: string;
  condition?: string;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  driveType?: string;
  engine?: string;
  horsepower?: number | null;
  exteriorColor?: string;
  interiorColor?: string;
  seats?: number;
  doors?: number;
  price?: number;
  previousPrice?: number | null;
  location?: string;
  state?: string;
  currentDescription: string;
  onApplyDescription: (nextDescription: string) => void;
}

export const DealerListingAiPanel: React.FC<DealerListingAiPanelProps> = ({
  carId,
  make,
  model,
  trim,
  year,
  bodyType,
  condition,
  mileage,
  transmission,
  fuelType,
  driveType,
  engine,
  horsepower,
  exteriorColor,
  interiorColor,
  seats,
  doors,
  price,
  previousPrice,
  location,
  state,
  currentDescription,
  onApplyDescription,
}) => {
  const [tone, setTone] = useState<ListingTone>('executive_concierge');
  const [targetBuyer, setTargetBuyer] = useState<ListingTargetBuyer>('lagos_abuja_executive');
  const [length, setLength] = useState<ListingLength>('standard');
  const [approach, setApproach] = useState<ListingApproach>('inspection_led');
  const [sellingAngle, setSellingAngle] = useState<ListingSellingAngle>('verified_condition');
  const [callToAction, setCallToAction] = useState<ListingCallToAction>('concierge_enquiry');
  const [customInstructions, setCustomInstructions] = useState('');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ListingCopyResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const canGenerate = Boolean(make.trim() && model.trim());

  const runAction = async (action: ListingActionType) => {
    if (!canGenerate) {
      setError('Select a Brand / Make and Vehicle Model above before generating listing copy.');
      return;
    }
    if (
      action !== 'generate' &&
      action !== 'regenerate' &&
      !currentDescription.trim() &&
      !result?.description
    ) {
      setError('Generate or type an initial description first before refining it.');
      return;
    }

    setGenerating(true);
    setError(null);
    setConfirmOverwrite(false);

    try {
      const sourceText = currentDescription.trim() || result?.description || undefined;
      const res = await aiService.generateListingCopy({
        carId,
        make: make.trim(),
        model: model.trim(),
        trim: trim?.trim() || undefined,
        year,
        bodyType: bodyType?.trim() || undefined,
        condition: condition?.trim() || undefined,
        mileage,
        transmission: transmission?.trim() || undefined,
        fuelType: fuelType?.trim() || undefined,
        driveType: driveType?.trim() || undefined,
        engine: engine?.trim() || undefined,
        horsepower: horsepower ?? undefined,
        exteriorColor: exteriorColor?.trim() || undefined,
        interiorColor: interiorColor?.trim() || undefined,
        seats,
        doors,
        price,
        previousPrice: previousPrice ?? undefined,
        location: location?.trim() || undefined,
        state: state?.trim() || undefined,
        action,
        currentDescription: sourceText,
        tone,
        targetBuyer,
        length,
        approach,
        sellingAngle,
        callToAction,
        customInstructions: customInstructions.trim() || undefined,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to generate listing copy.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2200);
    } catch {
      // ignore clipboard denial
    }
  };

  const handleInsertClick = () => {
    if (!result) return;
    if (currentDescription.trim().length > 0 && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    onApplyDescription(result.description);
    setConfirmOverwrite(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#EF233C]" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#071A2B]">
              Dealer Listing Intelligence
            </span>
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Writes structured copy strictly from your entered specs. Vehicle headline remains your factual model name.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full self-start sm:self-center">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Model Title Protected</span>
        </span>
      </div>

      {/* Style & Strategy Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as ListingTone)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="executive_concierge">Executive Concierge</option>
            <option value="trust_transparent">Trust &amp; Transparent</option>
            <option value="performance_enthusiast">Performance Enthusiast</option>
            <option value="family_practical">Family Practical</option>
            <option value="value_focused">Value Focused</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Target Buyer
          </label>
          <select
            value={targetBuyer}
            onChange={(e) => setTargetBuyer(e.target.value as ListingTargetBuyer)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="lagos_abuja_executive">Lagos / Abuja Executive</option>
            <option value="family_buyer">Family Buyer</option>
            <option value="first_time_tokunbo_buyer">First-Time Tokunbo Buyer</option>
            <option value="corporate_fleet">Corporate Fleet</option>
            <option value="enthusiast">Automotive Enthusiast</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Length
          </label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as ListingLength)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="concise">Concise (90–140w)</option>
            <option value="standard">Standard (140–210w)</option>
            <option value="comprehensive">Detailed (210–300w)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Content Approach
          </label>
          <select
            value={approach}
            onChange={(e) => setApproach(e.target.value as ListingApproach)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="inspection_led">Inspection-Led Clarity</option>
            <option value="facts_and_value">Facts &amp; Spec Sheet</option>
            <option value="story_and_lifestyle">Executive Lifestyle</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Selling Angle
          </label>
          <select
            value={sellingAngle}
            onChange={(e) => setSellingAngle(e.target.value as ListingSellingAngle)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="verified_condition">Verified Condition</option>
            <option value="value_and_pricing">Value &amp; Pricing</option>
            <option value="comfort_and_spec">Comfort &amp; Cabin Spec</option>
            <option value="reliability_and_low_running_cost">Reliability &amp; Running Cost</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Call to Action
          </label>
          <select
            value={callToAction}
            onChange={(e) => setCallToAction(e.target.value as ListingCallToAction)}
            className="w-full h-9 px-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800"
          >
            <option value="concierge_enquiry">MANIFOLD Concierge Enquiry</option>
            <option value="book_inspection">Book Physical Inspection</option>
            <option value="request_video_walkaround">Watch Video Walkaround</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
          Verified Dealer Notes (Optional — only facts you want mentioned)
        </label>
        <input
          type="text"
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="e.g. Custom duty cleared at Tin Can Island, panoramic sunroof, two smart keys available"
          className="w-full h-9 px-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-800"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runAction('generate')}
          disabled={generating || !canGenerate}
          className="px-4 py-2 bg-[#071A2B] hover:bg-[#0B2239] disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-[#EF233C]" />}
          <span>Generate Description</span>
        </button>

        <button
          type="button"
          onClick={() => runAction('regenerate')}
          disabled={generating || !canGenerate}
          className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Regenerate</span>
        </button>

        <button
          type="button"
          onClick={() => runAction('more_persuasive')}
          disabled={generating || !canGenerate}
          className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
        >
          More Persuasive
        </button>

        <button
          type="button"
          onClick={() => runAction('shorter')}
          disabled={generating || !canGenerate}
          className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
        >
          Shorter
        </button>

        <button
          type="button"
          onClick={() => runAction('more_detailed')}
          disabled={generating || !canGenerate}
          className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
        >
          More Detailed
        </button>

        <button
          type="button"
          onClick={() => runAction('improve_grammar')}
          disabled={generating || !canGenerate}
          className="px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-50 text-gray-700 text-xs font-semibold rounded-xl cursor-pointer"
        >
          Improve Grammar
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Structured AI Preview Output */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div className="text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Locked Listing Model Title
              </span>
              <strong className="text-[#071A2B]">{result.preserved_model_title}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy('description', result.description)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold rounded-lg inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedField === 'description' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'description' ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={handleInsertClick}
                className="px-3.5 py-1.5 bg-[#EF233C] hover:bg-[#d91b32] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                <span>{confirmOverwrite ? 'Confirm Replace Existing Text' : 'Accept & Insert Description'}</span>
              </button>
            </div>
          </div>

          {confirmOverwrite && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs text-amber-900">
              <span>Your description field already has text. Click confirm above to replace it, or copy below.</span>
              <button
                type="button"
                onClick={() => setConfirmOverwrite(false)}
                className="text-[11px] font-bold underline shrink-0"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Generated Listing Description
            </span>
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-3 rounded-xl border border-gray-100">
              {result.description}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Short Summary &amp; SEO Metadata
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'seo',
                      `${result.short_summary}\n\nSEO Title: ${result.seo_title}\nMeta: ${result.seo_meta_description}`
                    )
                  }
                  className="text-[11px] font-semibold text-gray-500 hover:text-[#071A2B]"
                >
                  {copiedField === 'seo' ? 'Copied!' : 'Copy Summary & SEO'}
                </button>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-[11px]">
                <p className="text-gray-700">{result.short_summary}</p>
                <div className="pt-1 border-t border-gray-200/70">
                  <span className="font-bold text-gray-500 block">SEO Title:</span>
                  <span className="text-gray-900 font-medium">{result.seo_title}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-500 block">Meta Description:</span>
                  <span className="text-gray-600">{result.seo_meta_description}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  5 Factual Selling Highlights
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(
                      'highlights',
                      result.selling_highlights.map((h) => `• ${h}`).join('\n')
                    )
                  }
                  className="text-[11px] font-semibold text-gray-500 hover:text-[#071A2B]"
                >
                  {copiedField === 'highlights' ? 'Copied!' : 'Copy Highlights'}
                </button>
              </div>
              <ul className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1.5 text-[11px] text-gray-700">
                {result.selling_highlights.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#EF233C] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
