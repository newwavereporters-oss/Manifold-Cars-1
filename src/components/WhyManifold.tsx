import React from 'react';
import { Video, ShieldCheck, UserCheck, ShieldAlert } from 'lucide-react';

export const WhyManifold: React.FC = () => {
  const features = [
    {
      icon: Video,
      title: 'Video First',
      description: 'Every car comes with a real video review, full walkaround, and cold-start inspection.',
    },
    {
      icon: ShieldCheck,
      title: 'Verified Vehicles',
      description: 'We physically inspect dealers and vehicle information before anything goes live.',
    },
    {
      icon: UserCheck,
      title: 'Expert Guidance',
      description: 'Get unbiased guidance from MANIFOLD specialists from initial shortlist to registration.',
    },
    {
      icon: ShieldAlert,
      title: 'You Deal With Us',
      description: 'No direct dealer pressure or nuisance calls. MANIFOLD securely manages your entire purchase.',
    },
  ];

  return (
    <section className="py-16 bg-[#F7F8FA] border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#EF233C]">
            The MANIFOLD Standard
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#071A2B] tracking-tight font-display mt-1">
            Why Choose MANIFOLD?
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            More than a marketplace. We help you find, verify and buy the right car in Nigeria with
            total confidence.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-start"
              >
                <div className="w-12 h-12 rounded-lg bg-red-50 text-[#EF233C] flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#071A2B] uppercase tracking-wide">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 leading-relaxed">
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
