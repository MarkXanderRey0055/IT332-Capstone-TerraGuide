import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Home,
  Users,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Sparkles,
  Gauge,
  RefreshCw,
} from 'lucide-react';
import { getProperties } from '../../services/PropertyService';
import { getAiUsageStatus, type AIUsageStatus } from '../../services/AIUsageService';
import { getPendingTransactionCount } from '../../services/TransactionService';
import {
  getDashboardSummary,
  getSalesPerformance,
  getRecentActivity,
  type DashboardSummary,
  type SalesPerformance,
  type RecentActivityItem,
  type RecentActivityType,
} from '../../services/AnalyticsService';
import { AdminTransactions } from './AdminTransactions';
import { AdminProperties } from './AdminProperties';
import { AdminBuyers } from './AdminBuyers';
import { AdminAnalytics } from './AdminAnalytics';
import type { Property } from '../../types/types';

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

type AdminDashboardProps = {
  onLogout?: () => void;
};

const NAV_ITEMS: Omit<NavItem, 'badge'>[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'properties', label: 'Properties', icon: <Home className="w-5 h-5" /> },
  { id: 'buyers', label: 'Buyers', icon: <Users className="w-5 h-5" /> },
  { id: 'transactions', label: 'Transactions', icon: <Landmark className="w-5 h-5" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  properties: 'Properties',
  buyers: 'Buyers',
  transactions: 'Transactions',
  analytics: 'Analytics',
  settings: 'Settings',
};

const formatPeso = (amount: number) => `₱${Math.round(amount).toLocaleString('en-US')}`;

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [aiUsage, setAiUsage] = useState<AIUsageStatus | null>(null);
  const [isLoadingAiUsage, setIsLoadingAiUsage] = useState(true);
  const [aiUsageError, setAiUsageError] = useState('');
  const [pendingTransactionCount, setPendingTransactionCount] = useState<number | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [salesPerformance, setSalesPerformance] = useState<SalesPerformance | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(true);

  const navItems: NavItem[] = NAV_ITEMS;

  const activityStyle = (type: RecentActivityType) => {
    if (type === 'buyer_registered') return 'admin-panel-muted border-amber-700/20 bg-amber-100/40';
    if (type === 'property_added') return 'admin-panel-muted border-sky-700/20 bg-sky-100/35';
    return 'admin-panel-muted border-emerald-700/20 bg-emerald-100/35';
  };

  const activityLabel = (type: RecentActivityType) => {
    if (type === 'buyer_registered') return 'Buyer';
    if (type === 'property_added') return 'Property';
    return 'Transaction';
  };

  // Daily quota warning thresholds: 0-69% normal, 70-89% approaching,
  // 90-99% almost at limit, 100% reached. Reuses the same amber/red
  // classes already used for status badges elsewhere in the admin UI.
  const getDailyUsageState = (percentage: number) => {
    if (percentage >= 100) {
      return { label: 'Daily AI limit reached.', barColor: 'bg-red-500', textColor: 'text-red-600' };
    }
    if (percentage >= 90) {
      return { label: 'Almost at today\'s AI limit.', barColor: 'bg-amber-500', textColor: 'text-amber-600' };
    }
    if (percentage >= 70) {
      return { label: "AI usage is approaching today's limit.", barColor: 'bg-amber-500', textColor: 'text-amber-600' };
    }
    return { label: null, barColor: 'bg-[#45654d]', textColor: 'text-[#45654d]' };
  };

  const getRpmState = (current: number, limit: number) => {
    const percentage = limit > 0 ? (current / limit) * 100 : 0;
    if (percentage >= 100) {
      return { dot: 'bg-red-500', label: 'Rate limited', message: 'AI requests temporarily rate limited.', textColor: 'text-red-600' };
    }
    if (percentage >= 70) {
      return { dot: 'bg-amber-500', label: 'Approaching limit', message: 'AI request rate is approaching the configured limit.', textColor: 'text-amber-600' };
    }
    return { dot: 'bg-emerald-500', label: 'Operational', message: null, textColor: 'text-[#45654d]' };
  };

  const formatResetTime = (resetAtIso: string) => {
    const resetDate = new Date(resetAtIso);
    const now = new Date();
    const msRemaining = resetDate.getTime() - now.getTime();
    const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60)));
    const timeLabel = resetDate.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    return `Resets at ${timeLabel} · in ${hoursRemaining}h ${minutesRemaining}m`;
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchProperties = async () => {
      setIsLoadingProperties(true);
      try {
        const fetched = await getProperties();
        if (isCancelled) return;
        setProperties(fetched);
      } catch (error) {
        if (isCancelled) return;
        setToast(
          error instanceof Error
            ? error.message
            : 'Could not load property listings.'
        );
      } finally {
        if (!isCancelled) setIsLoadingProperties(false);
      }
    };

    fetchProperties();

    return () => {
      isCancelled = true;
    };
  }, []);

  const fetchAiUsage = async () => {
    try {
      const status = await getAiUsageStatus();
      setAiUsage(status);
      setAiUsageError('');
    } catch (error) {
      setAiUsageError(
        error instanceof Error ? error.message : 'Could not load AI usage status.'
      );
    }
  };

  useEffect(() => {
    setIsLoadingAiUsage(true);
    fetchAiUsage().finally(() => setIsLoadingAiUsage(false));
  }, []);

  useEffect(() => {
    getPendingTransactionCount()
      .then(setPendingTransactionCount)
      .catch(() => setPendingTransactionCount(null));
  }, []);

  const handleRefreshAiUsage = async () => {
    setIsLoadingAiUsage(true);
    await fetchAiUsage();
    setIsLoadingAiUsage(false);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchDashboardData = async () => {
      setIsLoadingDashboardData(true);
      try {
        const [summary, sales, activity] = await Promise.all([
          getDashboardSummary(),
          getSalesPerformance(),
          getRecentActivity(),
        ]);
        if (isCancelled) return;
        setDashboardSummary(summary);
        setSalesPerformance(sales);
        setRecentActivity(activity);
      } catch (error) {
        if (isCancelled) return;
        setToast(error instanceof Error ? error.message : 'Could not load dashboard data.');
      } finally {
        if (!isCancelled) setIsLoadingDashboardData(false);
      }
    };

    fetchDashboardData();
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleNavClick = (id: string) => {
    if (id === 'logout') {
      setLogoutConfirmOpen(true);
      return;
    }
    setActiveNav(id);
    setSidebarOpen(false);
  };

  const handleConfirmLogout = () => {
    setLogoutConfirmOpen(false);
    onLogout?.();
  };

  const handleCancelLogout = () => {
    setLogoutConfirmOpen(false);
  };

  const activeTitle = PAGE_TITLES[activeNav] ?? 'Dashboard';

  return (
    <div className="admin-shell h-screen w-full flex overflow-hidden font-sans">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden border-none cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 shrink-0 flex flex-col
          admin-sidebar
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-5 py-6 border-b border-[#ccbba4]">
          <div className="flex items-center gap-3">
            <div className="admin-button w-9 h-9 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-[#2f2417] font-serif font-bold text-lg tracking-wide">TerraGuide</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors cursor-pointer border-none
                  ${isActive
                    ? 'admin-button text-white'
                    : 'bg-transparent text-[#6f604d] hover:text-[#2f2417] hover:bg-white/40'
                  }
                `}
              >
                <span className={isActive ? 'text-[#f3e7c5]' : 'text-[#8e7a61]'}>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge != null && (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => handleNavClick('logout')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#6f604d] hover:text-[#2f2417] hover:bg-white/40 transition-colors cursor-pointer border-none mt-2"
          >
            <span className="text-[#8e7a61]">
              <LogOut className="w-5 h-5" />
            </span>
            <span className="flex-1 text-left">Logout</span>
          </button>
        </nav>

        <div className="px-4 py-4 border-t border-[#ccbba4]">
          <div className="flex items-center gap-3">
            <div className="admin-button w-9 h-9 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-sm">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#2f2417] text-sm font-semibold truncate">Admin Head</p>
              <p className="text-[#7c6a57] text-xs truncate">admin@terraguide.com</p>
            </div>
            <button
              type="button"
              onClick={() => handleNavClick('logout')}
              aria-label="Logout"
              className="text-[#8e7a61] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="admin-header shrink-0 flex items-center gap-4 px-4 sm:px-6 py-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="lg:hidden text-[#8e7a61] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[#2f2417] font-serif text-xl sm:text-2xl font-bold truncate">{activeTitle}</h1>
            <p className="text-[#7c6a57] text-xs sm:text-sm mt-0.5">
              {activeNav === 'properties'
                ? 'Create, modify, and audit real estate listings.'
                : activeNav === 'buyers'
                  ? 'View and manage buyer accounts registered through the portal.'
                  : activeNav === 'analytics'
                    ? 'Portfolio performance, compliance trends, and properties that need attention.'
                    : activeNav === 'transactions'
                      ? 'Track deals from reservation through to a completed sale.'
                      : 'Manage listings, buyers, and transactions from one place.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden text-[#8e7a61] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className={`w-5 h-5 ${sidebarOpen ? 'block' : 'hidden'}`} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeNav === 'dashboard' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Properties',
                      value: dashboardSummary ? String(dashboardSummary.totalProperties) : '—',
                      change: dashboardSummary ? `+${dashboardSummary.propertiesAddedThisMonth} this month` : '',
                    },
                    {
                      label: 'Active Buyers',
                      value: dashboardSummary ? String(dashboardSummary.totalBuyers) : '—',
                      change: dashboardSummary ? `+${dashboardSummary.buyersRegisteredThisMonth} this month` : '',
                    },
                    {
                      label: 'Pending Transactions',
                      value: pendingTransactionCount === null ? '—' : String(pendingTransactionCount),
                      change: 'Reserved + Processing',
                    },
                    {
                      label: 'Revenue (YTD)',
                      value: salesPerformance ? formatPeso(salesPerformance.revenueYTD) : '—',
                      change: 'Year to date',
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="admin-panel rounded-2xl p-5"
                    >
                      <p className="text-[#7c6a57] text-xs uppercase tracking-wider">{stat.label}</p>
                      <p className="text-[#2f2417] text-2xl font-bold mt-2">{stat.value}</p>
                      <p className="text-[#45654d] text-xs mt-2">{stat.change}</p>
                    </div>
                  ))}
                </div>

                {/* AI Usage — operational status card, not a second analytics page */}
                <div className="admin-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-[#d6c7b2] pb-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <h2 className="text-[#2f2417] font-semibold text-base">AI Usage</h2>
                    </div>
                    <button
                      type="button"
                      onClick={handleRefreshAiUsage}
                      disabled={isLoadingAiUsage}
                      className="text-[#5d503f] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1 disabled:opacity-50"
                      title="Refresh AI usage status"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAiUsage ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {isLoadingAiUsage && !aiUsage ? (
                    <p className="text-[#7c6a57] text-sm">Loading AI usage status...</p>
                  ) : aiUsageError && !aiUsage ? (
                    <p className="text-red-600 text-sm">{aiUsageError}</p>
                  ) : aiUsage ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Daily quota */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57] mb-1">
                          AI Usage Today
                        </p>
                        <p className="text-[#2f2417] text-2xl font-bold">
                          {aiUsage.daily.used} <span className="text-sm font-semibold text-[#9d8c76]">/ {aiUsage.daily.limit}</span>
                        </p>
                        <div className="w-full h-2 rounded-full overflow-hidden mt-2 bg-black/10">
                          <div
                            className={`h-full transition-all ${getDailyUsageState(aiUsage.daily.percentage).barColor}`}
                            style={{ width: `${Math.min(aiUsage.daily.percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-[#7c6a57] mt-1.5">
                          {aiUsage.daily.remaining} request{aiUsage.daily.remaining === 1 ? '' : 's'} remaining
                        </p>
                        <p className="text-[10px] text-[#9d8c76] mt-0.5">{formatResetTime(aiUsage.resetAt)}</p>
                        {getDailyUsageState(aiUsage.daily.percentage).label && (
                          <p className={`text-[10px] font-semibold mt-1.5 ${getDailyUsageState(aiUsage.daily.percentage).textColor}`}>
                            {getDailyUsageState(aiUsage.daily.percentage).label}
                          </p>
                        )}
                      </div>

                      {/* RPM status */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57] mb-1 flex items-center gap-1.5">
                          <Gauge className="w-3 h-3" /> AI Request Rate
                        </p>
                        <p className="text-[#2f2417] text-2xl font-bold">
                          {aiUsage.rpm.current} <span className="text-sm font-semibold text-[#9d8c76]">/ {aiUsage.rpm.limit} RPM</span>
                        </p>
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <span className={`w-2 h-2 rounded-full ${getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).dot}`} />
                          <span className={`text-[11px] font-semibold ${getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).textColor}`}>
                            {getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).label}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#9d8c76] mt-1.5">
                          Short-term request rate — separate from the daily quota.
                        </p>
                        {getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).message && (
                          <p className={`text-[10px] font-semibold mt-1.5 ${getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).textColor}`}>
                            {getRpmState(aiUsage.rpm.current, aiUsage.rpm.limit).message}
                          </p>
                        )}
                      </div>

                      {/* Breakdown */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57] mb-2">
                          Usage Breakdown
                        </p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[#6f604d]">Compliance Audits</span>
                            <span className="font-semibold text-[#2f2417]">{aiUsage.breakdown.compliance}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#6f604d]">Portfolio Insights</span>
                            <span className="font-semibold text-[#2f2417]">{aiUsage.breakdown.portfolio}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[#6f604d]">Market Insights</span>
                            <span className="font-semibold text-[#2f2417]">{aiUsage.breakdown.market}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-[#d6c7b2] mt-1.5">
                            <span className="text-[#2f2417] font-semibold">Total</span>
                            <span className="font-bold text-[#2f2417]">
                              {aiUsage.daily.used} / {aiUsage.daily.limit}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="admin-panel rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-4 border-b border-[#d6c7b2] pb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-700" />
                      <h2 className="text-[#2f2417] font-semibold text-base">Activity Notifications</h2>
                    </div>
                  </div>

                  {isLoadingDashboardData ? (
                    <p className="text-[#7c6a57] text-sm mt-4">Loading recent activity...</p>
                  ) : recentActivity.length === 0 ? (
                    <p className="text-[#7c6a57] text-sm mt-4">
                      No activity yet. This section reflects real properties, buyers, and
                      transactions as they're added.
                    </p>
                  ) : (
                    <div className="space-y-3 mt-4 max-h-[320px] overflow-y-auto pr-1">
                      {recentActivity.map((activity, index) => (
                        <div
                          key={`${activity.type}-${activity.timestamp}-${index}`}
                          className={`p-4 rounded-xl border flex items-start gap-3 ${activityStyle(activity.type)}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7c6a57] shrink-0">
                                  {activityLabel(activity.type)}
                                </span>
                                <p className="text-[#2f2417] text-sm font-semibold truncate">{activity.title}</p>
                              </div>
                              <span className="text-[10px] text-[#7c6a57] shrink-0">
                                {new Date(activity.timestamp).toLocaleString('en-PH', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-[#6f604d] text-xs mt-1">{activity.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {activeNav === 'properties' && (
              <AdminProperties
                properties={properties}
                setProperties={setProperties}
                onToast={setToast}
                isLoading={isLoadingProperties}
              />
            )}

            {activeNav === 'buyers' && <AdminBuyers onToast={setToast} />}

            {activeNav === 'analytics' && <AdminAnalytics onToast={setToast} />}

            {activeNav === 'transactions' && <AdminTransactions onToast={setToast} />}

            {activeNav !== 'dashboard' &&
              activeNav !== 'properties' &&
              activeNav !== 'buyers' &&
              activeNav !== 'analytics' &&
              activeNav !== 'transactions' && (
              <div className="admin-panel rounded-2xl p-8 text-center">
                <div className="admin-button w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {navItems.find((item) => item.id === activeNav)?.icon}
                </div>
                <h2 className="text-[#2f2417] font-serif text-xl font-bold">{activeTitle}</h2>
                <p className="text-[#7c6a57] text-sm mt-2 max-w-md mx-auto">
                  This section is ready for content. Select another item from the sidebar to navigate
                  the admin portal.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Dismiss logout confirmation"
            className="absolute inset-0 bg-black/60 border-none cursor-pointer"
            onClick={handleCancelLogout}
          />
          <div className="admin-panel relative w-full max-w-sm rounded-2xl p-6">
            <div className="admin-button w-11 h-11 rounded-xl flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5 text-emerald-300" />
            </div>
            <h2 className="text-[#2f2417] font-serif text-lg font-bold">Log out of TerraGuide?</h2>
            <p className="text-[#6f604d] text-sm mt-2">
              Are you sure you want to log out? You'll need to sign in again to access the admin
              portal.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={handleCancelLogout}
                className="admin-button-secondary px-4 py-2 rounded-lg text-sm font-medium text-[#5d503f] border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 border-none cursor-pointer transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="admin-panel fixed bottom-6 right-6 z-[600] px-4 py-3 text-[#2f4736] text-sm font-medium rounded-xl">
          {toast}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;