import React from 'react';
import { Youtube, Instagram, Facebook, Twitter, Phone, Mail, MapPin } from 'lucide-react';
import footerCityscapeBg from '../assets/images/Cinematic Luxury SUV Cityscape at Sunset.png';

interface FooterProps {
  navigate: (route: string) => void;
  onFilterBrand: (brandName: string) => void;
  onOpenAdminLogin?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ navigate, onFilterBrand, onOpenAdminLogin }) => {
  const handleNav = (route: string) => {
    navigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-[#071A2B] text-white border-t border-white/10 pt-16 pb-12 overflow-hidden">
      {/* Cinematic Luxury SUV Cityscape at Sunset Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none bg-[#071A2B]"
        style={{
          backgroundImage: `url("${footerCityscapeBg}")`,
          backgroundPosition: 'center bottom',
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <img
          src={footerCityscapeBg}
          alt="MANIFOLD Automotive Footer Background"
          className="w-full h-full object-cover object-bottom filter brightness-70 contrast-110"
          onError={(e) => {
            const target = e.currentTarget;
            if (target.src !== '/assets/images/Cinematic%20Luxury%20SUV%20Cityscape%20at%20Sunset.png') {
              target.src = '/assets/images/Cinematic%20Luxury%20SUV%20Cityscape%20at%20Sunset.png';
            }
          }}
        />
        {/* Deep navy overlays for legibility while keeping the cinematic cityscape at sunset vividly visible */}
        <div className="absolute inset-0 bg-[#071A2B]/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#071A2B] via-[#071A2B]/55 to-[#071A2B]/85" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-white/10">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-4">
            <div
              onClick={() => handleNav('/')}
              className="cursor-pointer inline-flex flex-col group"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight text-white font-display">
                  MANIFOLD
                </span>
                <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
              </div>
              <span className="text-[9px] font-medium tracking-[0.25em] text-gray-400 uppercase">
                FIND · VERIFY · DRIVE
              </span>
            </div>

            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Nigeria's car discovery and buying concierge. We connect verified buyers to physically
              inspected vehicles with real video reviews and complete purchase protection.
            </p>

            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://www.youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#EF233C] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                aria-label="MANIFOLD on YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#EF233C] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                aria-label="MANIFOLD on Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#EF233C] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                aria-label="MANIFOLD on Facebook"
              >
                <Facebook className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-[#EF233C] text-gray-300 hover:text-white flex items-center justify-center transition-colors"
                aria-label="MANIFOLD on X"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>

            <div className="pt-2 text-xs text-gray-400 space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>Lekki Phase 1 & Victoria Island, Lagos, Nigeria</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#EF233C]" />
                <span>concierge@manifold.ng</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200">Quick Links</h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <button
                  onClick={() => handleNav('/cars')}
                  className="hover:text-white transition-colors"
                >
                  Browse Cars
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/reviews')}
                  className="hover:text-white transition-colors"
                >
                  Car Reviews
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/car-hunt')}
                  className="hover:text-white transition-colors"
                >
                  Car Hunt
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/sell-a-car')}
                  className="hover:text-white transition-colors"
                >
                  Sell a Car
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/reviews')}
                  className="hover:text-white transition-colors"
                >
                  Blog & Market Insights
                </button>
              </li>
            </ul>
          </div>

          {/* Popular Brands */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Popular Brands
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              {['Toyota', 'Lexus', 'Mercedes-Benz', 'BMW', 'Range Rover', 'Honda', 'Hyundai'].map(
                (brand) => (
                  <li key={brand}>
                    <button
                      onClick={() => onFilterBrand(brand)}
                      className="hover:text-white transition-colors"
                    >
                      {brand}
                    </button>
                  </li>
                )
              )}
            </ul>
          </div>

          {/* Our Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-200">
              Our Services
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Car Sourcing (Car Hunt)
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Vehicle Physical Inspection
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Buying Concierge
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Trade-in Support
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Financing Assistance
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleNav('/services')}
                  className="hover:text-white transition-colors"
                >
                  Insurance & Registration
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <p>© 2026 MANIFOLD. All rights reserved. Nigeria's Automotive Concierge.</p>
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleNav('/about')}
              className="hover:text-white transition-colors"
            >
              About Us
            </button>
            <button
              onClick={() => handleNav('/dealer/sign-in')}
              className="hover:text-white transition-colors font-medium text-gray-300"
            >
              Dealer Portal
            </button>
            <button
              onClick={() => handleNav('/dealer/register')}
              className="hover:text-white transition-colors"
            >
              Register Dealership
            </button>
            <button
              onClick={() => handleNav('/about')}
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => handleNav('/about')}
              className="hover:text-white transition-colors"
            >
              Terms of Service
            </button>
            <span className="text-gray-600">·</span>
            <button
              onClick={() => {
                if (onOpenAdminLogin) {
                  onOpenAdminLogin();
                } else {
                  handleNav('/admin/login');
                }
              }}
              className="text-[11px] text-gray-300 hover:text-white transition-colors cursor-pointer font-medium hover:underline"
              title="MANIFOLD Operational Portal"
            >
              Admin Sign In
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
