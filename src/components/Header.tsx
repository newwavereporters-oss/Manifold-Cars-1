import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Heart,
  Menu,
  X,
  ChevronRight,
  Building2,
  Gamepad2,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDealerAuth } from '../context/DealerAuthContext';
import { useRole } from '../context/RoleContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { logoutPlayerAccount } from '../services/playerService';
import { supabase } from '../lib/supabase';
import { ManifoldBrandMark } from './ManifoldBrandMark';
import { PWAInstallButton } from './pwa/PWAInstallButton';

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
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const { isAdmin, signOut: adminSignOut } = useAuth();
  const { dealerAccount, signOut: dealerSignOut } = useDealerAuth();
  const {
    role,
    email,
    dealerBusinessName,
    playerNickname,
    isGamePlayer,
    isAdminAccount,
    isDealerAccount,
    refreshRole,
  } = useRole();
  const { canInstall: canInstallPWA, isInstalled: isPWAInstalled } = usePWAInstall();

  // Strict role separation: never expose another role's dashboard or login options
  const showAdmin = isAdmin && isAdminAccount;
  const showDealer =
    !showAdmin &&
    !isGamePlayer &&
    (isDealerAccount || role === 'dealer_onboarding' || Boolean(dealerAccount?.hasAccount));
  const showPlayer = !showAdmin && !showDealer && isGamePlayer;
  const showBuyer = !showAdmin && !showDealer && !showPlayer && role === 'buyer';
  const isAuthenticatedUser = showAdmin || showDealer || showPlayer || showBuyer;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu on Escape and restore focus cleanly to trigger button
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Close menu automatically when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [currentRoute]);

  const primaryDesktopLinks = [
    { label: 'Marketplace', route: '/car-marketplace' },
    { label: '3D World', route: '/3d-world' },
    { label: 'Dealers', route: '/dealers' },
  ];

  const exploreMenuLinks = [
    { label: 'Marketplace', route: '/car-marketplace' },
    { label: 'Browse Cars', route: '/cars' },
    { label: '3D World', route: '/3d-world' },
    { label: 'Dealers', route: '/dealers' },
  ];

  const secondaryMenuLinks = [
    { label: 'Car Hunt', route: '/car-hunt' },
    { label: 'Reviews', route: '/reviews' },
    { label: 'Sell a Car', route: '/sell-a-car' },
    { label: 'About', route: '/about' },
  ];

  const isRouteActive = (route: string) =>
    currentRoute === route ||
    (route === '/car-marketplace' && (currentRoute === '/' || currentRoute === '/marketplace')) ||
    (route === '/dealers' &&
      (currentRoute === '/dealers/:dealerSlug' || currentRoute === '/:dealerSlug')) ||
    (route === '/cars' && currentRoute === '/cars/:slug');

  const handleNavClick = (route: string) => {
    setMenuOpen(false);
    navigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      if (showAdmin) {
        await adminSignOut();
      } else if (showDealer) {
        await dealerSignOut();
      } else if (showPlayer) {
        await logoutPlayerAccount();
      } else {
        await supabase.auth.signOut().catch(() => {});
      }
      await refreshRole();
    } finally {
      setIsLoggingOut(false);
      setMenuOpen(false);
    }
  };

  const hasHeroBackdrop =
    currentRoute === '/car-marketplace' || currentRoute === '/3d-world' || currentRoute === '/';
  const showSolidHeader = !hasHeroBackdrop || isScrolled || menuOpen;

  const accountDisplayName = showAdmin
    ? 'Administrator'
    : showDealer
    ? dealerBusinessName || dealerAccount?.businessName || 'Dealer Account'
    : showPlayer
    ? playerNickname || '3D World Player'
    : email || 'MANIFOLD Account';

  const showInstallInMenu = !isPWAInstalled && canInstallPWA;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
          showSolidHeader
            ? 'bg-[#071A2B] border-b border-white/10 shadow-lg'
            : 'bg-gradient-to-b from-[#071A2B]/95 via-[#071A2B]/65 to-transparent'
        }`}
        style={{ height: 'var(--header-height, 76px)' }}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full gap-4 lg:gap-8">
            {/* Zone 1: Brand Logo */}
            <button
              type="button"
              onClick={() => handleNavClick('/car-marketplace')}
              className="cursor-pointer group flex items-center gap-2.5 shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF233C] rounded-lg"
              aria-label="MANIFOLD Marketplace Home"
            >
              <ManifoldBrandMark size="sm" />
              <span className="flex flex-col justify-center">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-display whitespace-nowrap">
                  MANIFOLD
                </span>
                <span className="text-[8px] sm:text-[9px] font-medium tracking-[0.22em] text-gray-300 uppercase transition-colors group-hover:text-white whitespace-nowrap">
                  FIND · VERIFY · DRIVE
                </span>
              </span>
            </button>

            {/* Zone 2: Clean Desktop Primary Destinations */}
            <nav
              className="hidden lg:flex items-center gap-7"
              aria-label="Primary Navigation"
            >
              {primaryDesktopLinks.map((item) => {
                const active = isRouteActive(item.route);
                return (
                  <button
                    key={item.route}
                    type="button"
                    onClick={() => handleNavClick(item.route)}
                    className={`text-sm font-medium tracking-wide transition-colors relative py-1.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF233C] rounded ${
                      active
                        ? 'text-white font-semibold'
                        : 'text-gray-200 hover:text-white'
                    }`}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#EF233C] rounded-full" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Visitor Actions & Hamburger Menu */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Search Cars */}
              <button
                type="button"
                onClick={onOpenSearch}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-200 hover:text-white transition-colors rounded-lg hover:bg-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF233C]"
                aria-label="Search cars"
                title="Search cars"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Saved Vehicles (visible on tablet/desktop; inside drawer on compact mobile) */}
              <button
                type="button"
                onClick={onOpenFavorites}
                className="hidden sm:flex min-w-[40px] min-h-[40px] items-center justify-center text-gray-200 hover:text-white transition-colors rounded-lg hover:bg-white/10 relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF233C]"
                aria-label="Saved vehicles"
                title="Saved vehicles"
              >
                <Heart className="w-5 h-5" />
                {favoritesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-[#EF233C] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center tabular-nums">
                    {favoritesCount}
                  </span>
                )}
              </button>

              {/* Single Clear Visitor CTA on Desktop */}
              <button
                type="button"
                onClick={() => handleNavClick('/cars')}
                className="hidden lg:inline-flex items-center justify-center bg-[#EF233C] hover:bg-[#d91b32] active:scale-[0.98] text-white text-xs font-bold tracking-wide px-4 py-2.5 min-h-[40px] rounded-lg shadow-sm transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Browse Cars
              </button>

              {/* Unified Hamburger Menu Button (Desktop & Mobile) */}
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF233C]"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                aria-controls="manifold-nav-menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Unified Hamburger Navigation Menu (Desktop Dropdown Panel & Mobile Slide-in Drawer) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden bg-black/75 lg:bg-black/30 backdrop-blur-sm lg:backdrop-blur-[1px] animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label="MANIFOLD Navigation Menu"
        >
          <div
            className="absolute inset-0"
            aria-hidden="true"
            onClick={() => setMenuOpen(false)}
          />

          <div
            id="manifold-nav-menu"
            className="relative ml-auto h-full w-screen max-w-sm bg-[#071A2B] text-white shadow-2xl flex flex-col justify-between border-l border-white/10 pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))] overflow-x-hidden lg:fixed lg:top-[calc(var(--header-height,76px)+8px)] lg:right-8 lg:ml-0 lg:h-auto lg:w-[340px] lg:max-w-[calc(100vw-2rem)] lg:max-h-[calc(100vh-100px)] lg:rounded-2xl lg:border lg:border-white/15 lg:pt-0 lg:pb-0"
          >
            {/* Mobile Drawer Top Header */}
            <div className="lg:hidden px-5 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <ManifoldBrandMark size="sm" />
                <div className="flex flex-col">
                  <span className="text-lg font-extrabold tracking-tight text-white font-display">
                    MANIFOLD
                  </span>
                  <span className="text-[8px] font-medium tracking-[0.2em] text-gray-400 uppercase">
                    FIND · VERIFY · DRIVE
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Menu Scrollable Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-5">
              {/* Section 1: Explore */}
              <section aria-label="Explore MANIFOLD">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 px-3 mb-2">
                  Explore
                </p>
                <div className="space-y-1">
                  {exploreMenuLinks.map((item) => {
                    const active = isRouteActive(item.route);
                    return (
                      <button
                        key={item.route}
                        type="button"
                        onClick={() => handleNavClick(item.route)}
                        className={`w-full min-h-[44px] flex items-center justify-between text-left text-sm font-semibold px-3.5 py-2.5 rounded-xl transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-[#EF233C] text-white'
                            : 'text-gray-100 hover:text-white hover:bg-white/8'
                        }`}
                      >
                        <span>{item.label}</span>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 ${
                            active ? 'text-white' : 'text-gray-500'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Concise secondary public destinations */}
                <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-white/10">
                  {secondaryMenuLinks.map((item) => {
                    const active = isRouteActive(item.route);
                    return (
                      <button
                        key={item.route}
                        type="button"
                        onClick={() => handleNavClick(item.route)}
                        className={`min-h-[40px] px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-white/15 text-white font-semibold'
                            : 'text-gray-300 hover:text-white hover:bg-white/8'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                {/* Mobile quick utilities (kept off compact mobile header) */}
                <div className="lg:hidden grid grid-cols-2 gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenFavorites();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/6 hover:bg-white/12 text-xs font-semibold text-gray-200 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Heart className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
                    <span>Saved ({favoritesCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenInquiry();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-white/6 hover:bg-white/12 text-xs font-semibold text-gray-200 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
                    <span>Concierge</span>
                  </button>
                </div>
              </section>

              {/* Section 2: Account Access (Strictly role-aware; Admin never exposed to unauthorized users) */}
              <section aria-label="Account Access" className="pt-4 border-t border-white/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400 px-3 mb-2">
                  Account Access
                </p>

                {!isAuthenticatedUser ? (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleNavClick('/dealer/sign-in')}
                      className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-gray-100 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Building2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Dealer Login
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleNavClick('/3d-world')}
                      className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-gray-100 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Gamepad2 className="w-4 h-4 text-[#EF233C] shrink-0" />
                        <span className="text-sm font-semibold whitespace-nowrap">
                          Player Login
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                      <User className="w-4 h-4 text-gray-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          Signed In
                        </p>
                        <p className="text-xs font-semibold text-white truncate">
                          {accountDisplayName}
                        </p>
                      </div>
                    </div>

                    {showAdmin && (
                      <button
                        type="button"
                        onClick={() => handleNavClick('/admin')}
                        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#d91b32] text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Admin Dashboard</span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </button>
                    )}

                    {showDealer && (
                      <button
                        type="button"
                        onClick={() =>
                          handleNavClick(
                            role === 'dealer_onboarding'
                              ? '/dealer/business-information'
                              : '/dealer/dashboard'
                          )
                        }
                        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#d91b32] text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <LayoutDashboard className="w-4 h-4 shrink-0" />
                          <span>Dealer Dashboard</span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </button>
                    )}

                    {showPlayer && (
                      <button
                        type="button"
                        onClick={() => handleNavClick('/3d-world')}
                        className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#EF233C] hover:bg-[#d91b32] text-white text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2.5">
                          <Gamepad2 className="w-4 h-4 shrink-0" />
                          <span>Player World Dashboard</span>
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0" />
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isLoggingOut}
                      onClick={() => void handleLogout()}
                      className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 text-gray-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <LogOut className="w-4 h-4 shrink-0" />
                      <span>{isLoggingOut ? 'Signing Out...' : 'Logout'}</span>
                    </button>
                  </div>
                )}
              </section>

              {/* Desktop Concierge Shortcut */}
              <div className="hidden lg:block pt-4 border-t border-white/10 space-y-2.5">
                {showInstallInMenu && (
                  <PWAInstallButton variant="drawer" onTriggered={() => setMenuOpen(false)} />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenInquiry();
                  }}
                  className="w-full min-h-[40px] flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/14 text-gray-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#EF233C] shrink-0" />
                  <span>Talk to MANIFOLD Concierge</span>
                </button>
              </div>
            </div>

            {/* Mobile Drawer Install Footer (only rendered when installable and NOT installed) */}
            {showInstallInMenu && (
              <div className="lg:hidden px-5 pt-4 pb-2 border-t border-white/10 bg-[#0B2239]/80 shrink-0">
                <PWAInstallButton variant="drawer" onTriggered={() => setMenuOpen(false)} />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
