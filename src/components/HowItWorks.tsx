import React from 'react';
import { Search, PhoneCall, CheckSquare, Car } from 'lucide-react';

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      step: '01',
      icon: Search,
      title: 'Search & Explore',
      description: 'Watch real video reviews and find vehicles that match your exact lifestyle and budget.',
    },
    {
      step: '02',
      icon: PhoneCall,
      title: 'Talk to MANIFOLD',
      description: 'Click "I\'m Interested". Our dedicated concierge team calls you to understand your requirements.',
    },
    {
      step: '03',
      icon: CheckSquare,
      title: 'View & Verify',
      description: 'We arrange an accompanied viewing, independent computer diagnostic check, and customs validation.',
    },
    {
      step: '04',
      icon: Car,
      title: 'Drive Away',
      description: 'Complete the transaction safely with MANIFOLD custody, registration support, and warranty options.',
    },
  ];

  return (
    <section className="py-16 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
            How It Works
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display mt-1">
            Buying With MANIFOLD
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            A seamless, stress-free four-step journey from video discovery to your driveway.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 relative">
          {steps.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="relative flex flex-col items-center text-center group">
                {/* Step Circle with Icon */}
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-full bg-[#071A2B] text-white flex items-center justify-center shadow-lg group-hover:bg-[#EF233C] transition-colors duration-200">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 bg-[#EF233C] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white">
                    {idx + 1}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-[#071A2B] uppercase tracking-wide">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
