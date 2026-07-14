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
} from 'lucide-react';
import { mockProperties } from './data';
import { loadProperties, saveProperties } from './propertyStorage';
import { AdminProperties } from './AdminProperties';
import { AdminBuyers } from './AdminBuyers';
import type { Property } from './types';

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
};

type AdminDashboardProps = {
  onLogout?: () => void;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, badge: 2 },
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>(() => loadProperties(mockProperties));
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveProperties(properties);
  }, [properties]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleNavClick = (id: string) => {
    if (id === 'logout') {
      onLogout?.();
      return;
    }
    setActiveNav(id);
    setSidebarOpen(false);
  };

  const activeTitle = PAGE_TITLES[activeNav] ?? 'Dashboard';

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#0f1f16] font-sans">
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
          bg-[#0a1810] border-r border-white/[0.06]
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-5 py-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2d6a4f] flex items-center justify-center shadow-[0_0_12px_rgba(45,106,79,0.45)]">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="text-white font-serif font-bold text-lg tracking-wide">TerraGuide</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
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
                    ? 'bg-[#1a3d2e] text-white'
                    : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }
                `}
              >
                <span className={isActive ? 'text-emerald-300' : 'text-gray-500'}>{item.icon}</span>
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
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer border-none mt-2"
          >
            <span className="text-gray-500">
              <LogOut className="w-5 h-5" />
            </span>
            <span className="flex-1 text-left">Logout</span>
          </button>
        </nav>

        <div className="px-4 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#2d6a4f] flex items-center justify-center shadow-[0_0_12px_rgba(45,106,79,0.35)] shrink-0">
              <span className="text-white font-semibold text-sm">A</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">Admin Head</p>
              <p className="text-gray-500 text-xs truncate">admin@terraguide.com</p>
            </div>
            <button
              type="button"
              onClick={() => handleNavClick('logout')}
              aria-label="Logout"
              className="text-gray-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1 shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="shrink-0 flex items-center gap-4 px-4 sm:px-6 py-4 border-b border-white/[0.06] bg-[#112a1d]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="lg:hidden text-gray-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-serif text-xl sm:text-2xl font-bold truncate">{activeTitle}</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
              {activeNav === 'properties'
                ? 'Create, modify, and audit real estate listings.'
                : activeNav === 'buyers'
                  ? 'View and manage buyer accounts registered through the portal.'
                  : 'Manage listings, buyers, and transactions from one place.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden text-gray-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1"
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
                    { label: 'Total Properties', value: '128', change: '+12 this month' },
                    { label: 'Active Buyers', value: '342', change: '+28 this month' },
                    { label: 'Pending Transactions', value: '17', change: '2 need review' },
                    { label: 'Revenue (YTD)', value: '₱24.6M', change: '+8.4% vs last year' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
                    >
                      <p className="text-gray-400 text-xs uppercase tracking-wider">{stat.label}</p>
                      <p className="text-white text-2xl font-bold mt-2">{stat.value}</p>
                      <p className="text-emerald-400/80 text-xs mt-2">{stat.change}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
                  <h2 className="text-white font-semibold text-base">Recent Activity</h2>
                  <p className="text-gray-500 text-sm mt-2">
                    Welcome to the TerraGuide admin dashboard. Use the sidebar to manage properties,
                    buyers, transactions, and analytics.
                  </p>
                </div>
              </>
            )}

            {activeNav === 'properties' && (
              <AdminProperties
                properties={properties}
                setProperties={setProperties}
                onToast={setToast}
              />
            )}

            {activeNav === 'buyers' && <AdminBuyers onToast={setToast} />}

            {activeNav !== 'dashboard' && activeNav !== 'properties' && activeNav !== 'buyers' && (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#1a3d2e] flex items-center justify-center mx-auto mb-4">
                  {NAV_ITEMS.find((item) => item.id === activeNav)?.icon}
                </div>
                <h2 className="text-white font-serif text-xl font-bold">{activeTitle}</h2>
                <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
                  This section is ready for content. Select another item from the sidebar to navigate
                  the admin portal.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[600] px-4 py-3 bg-[#1a3d2e] border border-emerald-500/30 text-emerald-100 text-sm font-medium rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
