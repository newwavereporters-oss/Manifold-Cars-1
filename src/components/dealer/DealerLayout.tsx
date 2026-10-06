import React, { useState } from 'react';
import { useDealerAuth } from '../../context/DealerAuthContext';
import {
  LayoutDashboard,
  CarFront,
  PlusCircle,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Newspaper,
  LineChart,
  BadgeDollarSign,
  Wallet,
  Building2,
  BookOpen,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

interface DealerLayoutProps {
  children: React.ReactNode;
  currentRoute: string;
  navigate: (route: string) => void;
  activeNavTab?: string;
  onSelectNavTab?: (tab: string) => void;
}

export const DealerLayout: React.FC<DealerLayoutProps> = ({
  children,
  currentRoute,
  navigate,
  activeNavTab = 'overview',
  onSelectNavTab,
}) => {
  const { user, dealerAccount, signOut } = useDealerAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const businessName = dealerAccount?.businessName || 'MANIFOLD Dealership';
  const status = dealerAccount?.accountStatus && dealerAccount.accountStatus !== 'pending' ? dealerAccount.accountStatus : 'active';

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, route: '/dealer/dashboard' },
    { id: 'cars', label: 'My Cars', icon: CarFront, route: '/dealer/cars' },
    { id: 'new-car', label: 'Add Vehicle', icon: PlusCircle, route: '/dealer/cars/new' },
    { id: 'offer', label: 'Explore MANIFOLD', icon: Sparkles, route: '/dealer/offer' },
    { id: 'enquiries', label: 'Enquiries', icon: MessageSquare, tab: 'enquiries' },
    { id: 'pricing-intel', label: 'Price Intelligence', icon: TrendingUp, tab: 'pricing-intel' },
    { id: 'market-intel', label: 'Market Intelligence', icon: BarChart3, tab: 'market-intel' },
    { id: 'news', label: 'Industry News', icon: Newspaper, tab: 'news' },
    { id: 'performance', label: 'Performance', icon: LineChart, tab: 'performance' },
    { id: 'sales', label: 'Sales', icon: BadgeDollarSign, tab: 'sales' },
    { id: 'earnings', label: 'Earnings', icon: Wallet, tab: 'earnings' },
    { id: 'profile', label: 'Business Profile', icon: Building2, tab: 'profile' },
    { id: 'guide', label: 'MANIFOLD Guide', icon: BookOpen, tab: 'guide' },
  ];

  const handleNavClick = (item: typeof navItems[0]) => {
    setMobileMenuOpen(false);
    if (item.route) {
      navigate(item.route);
    } else if (item.tab && onSelectNavTab) {
      if (currentRoute !== '/dealer/dashboard') {
        navigate('/dealer/dashboard');
      }
      onSelectNavTab(item.tab);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/dealer/sign-in');
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#111827] flex flex-col antialiased">
      {/* DEALER TOP HEADER */}
      <header className="sticky top-0 z-40 bg-[#071A2B] text-white border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Dealership Identity */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-white rounded-lg hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div
              onClick={() => navigate('/dealer/dashboard')}
              className="cursor-pointer flex items-center gap-2 group"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-white font-display">
                  MANIFOLD
                </span>
                <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
              </div>
              <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-widest text-[#EF233C] bg-red-950/60 border border-red-500/20 px-2 py-0.5 rounded">
                Dealer Portal
              </span>
            </div>

            <div className="hidden md:block h-5 w-[1px] bg-white/10" />

            {/* Dealership Name */}
            <div className="hidden md:flex flex-col">
              <span className="text-xs font-bold text-gray-200 tracking-tight leading-tight">
                {businessName}
              </span>
              <span className="text-[10px] text-gray-400">Verified Automobile Partner</span>
            </div>
          </div>

          {/* Right Header: Status Badge, Marketplace Link, Profile & Sign Out */}
          <div className="flex items-center gap-3">
            {/* Account Status Badge */}
            {status !== 'suspended' && status !== 'rejected' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ACTIVE</span>
              </div>
            )}
            {status === 'suspended' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>SUSPENDED</span>
              </div>
            )}
            {status === 'rejected' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-500/10 border border-gray-500/30 text-gray-400 text-[11px] font-bold uppercase tracking-wider">
                <span>REJECTED</span>
              </div>
            )}

            {/* Public Marketplace Quick Link */}
            <button
              onClick={() => navigate('/')}
              className="hidden lg:flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition"
              title="Visit Public Marketplace"
            >
              <span>Marketplace</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 transition text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-xs font-bold text-white">
                  {businessName.substring(0, 2).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0B2239] border border-white/10 rounded-xl shadow-2xl py-2 z-50 text-white animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2.5 border-b border-white/10">
                    <p className="text-xs font-bold text-white truncate">{businessName}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{user?.email}</p>
                    <div className="mt-1.5 inline-block text-[10px] font-semibold text-gray-300 bg-white/5 px-2 py-0.5 rounded">
                      Status: <span className="capitalize text-amber-300">{status}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/dealer/dashboard');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-gray-400" />
                      Dealer Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/dealer/cars');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <CarFront className="w-3.5 h-3.5 text-gray-400" />
                      Manage Vehicle Inventory
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        navigate('/dealer/cars/new');
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-gray-400" />
                      List a New Vehicle
                    </button>
                  </div>

                  <div className="border-t border-white/10 pt-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleSignOut();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-[#EF233C] hover:bg-red-500/10 flex items-center gap-2 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN DEALER CONTAINER WITH SIDEBAR & CONTENT */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex gap-6">
        {/* DESKTOP SIDEBAR NAVIGATION */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-3 sticky top-24 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Dealership Operations
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                (item.route && currentRoute === item.route) ||
                (item.tab && activeNavTab === item.tab && currentRoute === '/dealer/dashboard');

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                    isActive
                      ? 'bg-[#071A2B] text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#EF233C]' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-gray-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-[#EF233C] hover:bg-red-50 transition text-left"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        {/* MOBILE DRAWER MENU */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl p-4 flex flex-col z-50">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-extrabold tracking-tight text-[#071A2B] font-display">
                    MANIFOLD
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#EF233C]" />
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    (item.route && currentRoute === item.route) ||
                    (item.tab && activeNavTab === item.tab && currentRoute === '/dealer/dashboard');

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                        isActive
                          ? 'bg-[#071A2B] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#EF233C]' : 'text-gray-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#EF233C] hover:bg-red-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN OUTLET CONTENT */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
};
