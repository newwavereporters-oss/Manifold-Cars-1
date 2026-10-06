import React, { useState, useEffect } from 'react';
import { Search, Heart, Menu, X, PhoneCall, ChevronRight, Compass, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
  favoritesCount: number;
  onOpenFavorites: () => void;
  onOpenInquiry: (carTitle?: string) => void;
  onOpenSearch: () => void;
  onOpenAdminLogin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  navigate,
  favoritesCount,
  onOpenFavorites,
  onOpenInquiry,
  onOpenSearch,
  onOpenAdminLogin,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
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
    { label: 'About MANIFOLD', route: '/about' },
    { label: 'Dealer Portal', route: '/dealer/sign-in' },
  ];

  const handleNavClick = (route: string) => {
    navigate(route);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isHome = currentRoute === '/';
  const showSolidHeader = !isHome || isScrolled;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
          showSolidHeader
            ? 'bg-[#071A2B] border-b border-white/10 shadow-lg'
            : 'bg-gradient-to-b from-[#071A2B]/95 via-[#071A2B]/60 to-transparent'
        }`}
        style={{ height: 'var(--header-height, 76px)' }}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full gap-4">
            {/* Brand Wordmark & Tagline Lockup */}
            <div
              onClick={() => handleNavClick('/')}
              className="cursor-pointer group flex flex-col justify-center shrink-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-display">
                  MANIFOLD
                </span>
                <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
              </div>
              <span className="text-[8px] sm:text-[9px] font-medium tracking-[0.22em] text-gray-300 uppercase transition-colors group-hover:text-white">
                FIND · VERIFY · DRIVE
              </span>
            </div>

            {/* Desktop Navigation (Visible on lg: 1024px+) */}
            <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
              {navItems.map((item) => {
                const isActive = currentRoute === item.route;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavClick(item.route)}
                    className={`text-xs xl:text-sm font-medium tracking-wide transition-colors relative py-1 whitespace-nowrap ${
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
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

              {/* Primary Action Button (Red) - strictly single line */}
              <button
                onClick={() => onOpenInquiry()}
                className="hidden sm:inline-flex items-center gap-1.5 xl:gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider px-3.5 xl:px-4 py-2.5 rounded shadow-sm hover:shadow-red-500/20 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 shrink-0" />
                <span>Talk to MANIFOLD</span>
              </button>

              {/* Mobile / Tablet Menu Hamburger (Visible below lg: 1024px) */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/10"
                aria-label="Open navigation menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Full Slide-in Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden overflow-hidden bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-sm bg-[#071A2B] text-white shadow-2xl flex flex-col justify-between border-l border-white/10">
              {/* Drawer Header */}
              <div className="p-5 flex items-center justify-between border-b border-white/10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-extrabold tracking-tight text-white font-display">
                      MANIFOLD
                    </span>
                    <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
                  </div>
                  <span className="text-[8px] font-medium tracking-[0.2em] text-gray-400 uppercase">
                    FIND · VERIFY · DRIVE
                  </span>
                </div>

                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Drawer Links */}
              <div className="flex-1 overflow-y-auto p-5 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3 px-3">
                  Navigation
                </p>

                {navItems.map((item) => {
                  const isActive = currentRoute === item.route;
                  return (
                    <button
                      key={item.label}
                      onClick={() => handleNavClick(item.route)}
                      className={`w-full flex items-center justify-between text-left text-base font-semibold py-3 px-3.5 rounded-lg transition ${
                        isActive
                          ? 'bg-[#EF233C] text-white shadow'
                          : 'text-gray-200 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{item.label}</span>
                      <ChevronRight className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                    </button>
                  );
                })}

                <div className="pt-6 mt-6 border-t border-white/10 space-y-3">
                  <div className="flex items-center gap-2 px-3 text-xs text-gray-400">
                    <ShieldCheck className="w-4 h-4 text-[#EF233C]" />
                    <span>Nigeria's Automotive Concierge</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 text-xs text-gray-400">
                    <Compass className="w-4 h-4 text-[#EF233C]" />
                    <span>Verified Lagos & Abuja Dealerships</span>
                  </div>
                </div>
              </div>

              {/* Drawer Bottom Actions */}
              <div className="p-5 border-t border-white/10 bg-[#0B2239]/80 space-y-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenInquiry();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#EF233C] hover:bg-[#d91b32] text-white text-xs font-bold uppercase tracking-wider py-3.5 px-4 rounded shadow transition-all whitespace-nowrap active:scale-98"
                >
                  <PhoneCall className="w-4 h-4 shrink-0" />
                  <span>Talk to MANIFOLD</span>
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenAdminLogin) {
                      onOpenAdminLogin();
                    } else {
                      handleNavClick('/admin/login');
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-300 hover:text-white py-1.5 transition font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#EF233C]" />
                  <span>Admin Sign In</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

