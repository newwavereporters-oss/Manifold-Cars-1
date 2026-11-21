import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CarFront,
  ArrowRight,
  Compass,
  MessageSquare,
} from 'lucide-react';
import {
  aiService,
  AssistantMessage,
  AssistantSuggestedAction,
  AssistantVehicleCitation,
} from '../../services/aiService';
import { Car } from '../../types';

interface AiAutomotiveAssistantProps {
  surface: 'marketplace' | 'car_detail' | 'dealer_portal';
  focusedCar?: Car | null;
  allCars: Car[];
  navigate: (route: string) => void;
  onOpenInquiry: (car?: Car) => void;
  externalOpenSignal?: number;
}

interface UiTurn {
  role: 'user' | 'assistant';
  content: string;
  vehicles?: AssistantVehicleCitation[];
  actions?: AssistantSuggestedAction[];
}

export const AiAutomotiveAssistant: React.FC<AiAutomotiveAssistantProps> = ({
  surface,
  focusedCar,
  allCars,
  navigate,
  onOpenInquiry,
  externalOpenSignal = 0,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [turns, setTurns] = useState<UiTurn[]>([
    {
      role: 'assistant',
      content:
        surface === 'dealer_portal'
          ? 'Hello! I am the MANIFOLD Dealer Advisor. Ask me about listing quality, live stock comparison, or market benchmarks.'
          : 'Welcome to MANIFOLD Concierge AI. Tell me your budget, preferred model, or ask about Tokunbo vs Nigerian-used reliability across Lagos and Abuja.',
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (externalOpenSignal > 0) {
      setIsOpen(true);
    }
  }, [externalOpenSignal]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, isOpen]);

  const sendMessage = async (textOverride?: string) => {
    const content = (textOverride ?? input).trim();
    if (!content || sending) return;

    const userTurn: UiTurn = { role: 'user', content };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    if (!textOverride) setInput('');
    setSending(true);

    try {
      const apiHistory: AssistantMessage[] = nextTurns
        .slice(-10)
        .map((t) => ({ role: t.role, content: t.content }));

      const res = await aiService.sendAssistantMessage({
        messages: apiHistory,
        focusedCarSlug: focusedCar?.slug,
        surface,
      });

      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          vehicles: res.recommendedVehicles,
          actions: res.suggestedActions,
        },
      ]);
    } catch (err: any) {
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            err?.message ||
            'I could not connect to the AI advisor service right now. You can browse live vehicles or submit a Concierge Enquiry directly.',
          actions: [
            { label: 'Browse All Cars', actionType: 'browse_cars', target: '/cars' },
            { label: 'Start a Car Hunt', actionType: 'car_hunt', target: '/car-hunt' },
          ],
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleActionClick = (action: AssistantSuggestedAction) => {
    if (action.actionType === 'view_car') {
      navigate(`/cars/${action.target}`);
      setIsOpen(false);
    } else if (action.actionType === 'car_hunt') {
      navigate('/car-hunt');
      setIsOpen(false);
    } else if (action.actionType === 'browse_cars') {
      navigate('/cars');
      setIsOpen(false);
    } else if (action.actionType === 'open_inquiry') {
      const targetCar = allCars.find((c) => c.slug === action.target || c.id === action.target) || focusedCar || undefined;
      onOpenInquiry(targetCar);
      setIsOpen(false);
    } else if (action.actionType === 'dealer_pricing') {
      navigate('/dealer/cars');
      setIsOpen(false);
    }
  };

  const quickPrompts =
    surface === 'car_detail' && focusedCar
      ? [
          `Is this ${focusedCar.year} ${focusedCar.make} ${focusedCar.model} a good fit for Lagos roads?`,
          'What alternatives do you have around this price?',
        ]
      : surface === 'dealer_portal'
      ? [
          'How can we improve our listing descriptions for serious buyers?',
          'Which vehicle types are buyers currently asking about?',
        ]
      : [
          'Recommend a reliable Tokunbo SUV under 45M',
          'Best fuel-efficient sedans in Lagos right now',
        ];

  return (
    <>
      {/* Floating Concierge Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-full bg-[#071A2B] hover:bg-[#0B2239] text-white shadow-2xl border border-white/15 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider transition transform hover:-translate-y-0.5 cursor-pointer"
          aria-label="Open MANIFOLD AI Automotive Assistant"
        >
          <Sparkles className="w-4 h-4 text-[#EF233C]" />
          <span>Ask MANIFOLD AI</span>
        </button>
      )}

      {/* Slide-Over Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[82vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-[#071A2B] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#EF233C] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider">
                  MANIFOLD Automotive AI
                </h3>
                <p className="text-[10px] text-gray-300">
                  {focusedCar
                    ? `Viewing: ${focusedCar.title}`
                    : surface === 'dealer_portal'
                    ? 'Dealer Operations Advisor'
                    : 'Grounded in Verified Stock Only'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA]">
            {turns.map((turn, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'} space-y-2`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    turn.role === 'user'
                      ? 'bg-[#EF233C] text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {turn.content}
                </div>

                {/* Grounded Live Vehicle Citations */}
                {turn.vehicles && turn.vehicles.length > 0 && (
                  <div className="w-full space-y-1.5">
                    {turn.vehicles.map((v) => (
                      <button
                        key={v.slug}
                        type="button"
                        onClick={() => {
                          navigate(`/cars/${v.slug}`);
                          setIsOpen(false);
                        }}
                        className="w-full p-2.5 bg-white hover:bg-slate-50 border border-gray-200 rounded-xl text-left flex items-center justify-between gap-2 transition shadow-sm cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <CarFront className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
                            <span className="text-xs font-bold text-[#071A2B] truncate">
                              {v.title}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {v.condition} · {v.location} · ₦{Number(v.price_ngn).toLocaleString()}
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Concierge Action Buttons */}
                {turn.actions && turn.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="px-2.5 py-1 bg-[#071A2B] hover:bg-[#0B2239] text-white text-[10px] font-bold uppercase tracking-wider rounded-lg inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <Compass className="w-3 h-3 text-[#EF233C]" />
                        <span>{act.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#EF233C]" />
                <span>Checking verified MANIFOLD inventory...</span>
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Quick Prompt Pills */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => void sendMessage(qp)}
                disabled={sending}
                className="shrink-0 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-gray-700 cursor-pointer"
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="p-3 bg-white border-t border-gray-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about cars, prices, or inspections..."
              className="flex-1 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 outline-none focus:border-[#071A2B]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-10 w-10 bg-[#EF233C] hover:bg-[#d91b32] disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition cursor-pointer shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
