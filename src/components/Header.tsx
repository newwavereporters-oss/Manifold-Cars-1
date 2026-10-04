import React, { useState, useEffect } from 'react';
import { Search, Heart, Menu, X, PhoneCall } from 'lucide-react';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenInquiry: (carTitle?: string) => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  navigate,
  favoritesCount,
  onOpenFavorites,
  onOpenInquiry,
  onOpenSearch,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Cars', route: '/cars' },
    { label: 'Car Hunt', route: '/car-hunt' },
    { label: 'Car Reviews', route: '/reviews' },
    { label: 'Sell a Car', route: '/sell-a-car' },
    { label: 'Services', route: '/services' },
  ];

  const handleNavClick = (route: string) => {
    navigate(route);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isLightHero = currentRoute === '/' && !isScrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#071A2B]/95 backdrop-blur-md border-b border-white/10 shadow-lg py-3'
          : 'bg-gradient-to-b from-[#071A2B]/90 via-[#071A2B]/50 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          {/* Brand Wordmark & Tagline Lockup */}
          <div
            onClick={() => handleNavClick('/')}
            className="cursor-pointer group flex flex-col justify-center"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-white font-display">
                MANIFOLD
              </span>
              <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
            </div>
            <span className="text-[9px] font-medium tracking-[0.22em] text-gray-300 uppercase transition-colors group-hover:text-white">
              FIND · VERIFY · DRIVE
            </span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7">
            {navItems.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.route)}
                  className={`text-sm font-medium tracking-wide transition-colors relative py-1 ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF233C] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Zone */}
          <div className="flex items-center gap-3">
            {/* Search Trigger */}
            <button
              onClick={onOpenSearch}
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              aria-label="Search cars"
              title="Search cars"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Saved Cars / Favorites */}
            <button
              onClick={onOpenFavorites}
              className="p-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-white/10 relative"
              aria-label="Saved vehicles"
              title="Saved vehicles"
            >
              <Heart className="w-5 h-5" />
              {favoritesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#EF233C] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Primary Action Button (Red) */}
            <button
              onClick={() => onOpenInquiry()}
              className="hidden sm:inline-flex items-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded shadow-sm hover:shadow-red-500/20 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Talk to MANIFOLD</span>
            </button>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10"
              aria-label="Open navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#071A2B] border-b border-white/10 px-5 pt-3 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-2 pt-2">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.route)}
                className={`text-left text-base font-medium py-2 px-3 rounded-md transition-colors ${
                  currentRoute === item.route
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenInquiry();
              }}
              className="w-full flex items-center justify-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider py-3 rounded shadow transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Talk to MANIFOLD</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
