import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  UserCheck,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import type { AdminBuyerProfile } from '../../services/AdminBuyerService';
import { getBuyers } from '../../services/AdminBuyerService';
import { ApiError } from '../../utils/api';

interface AdminBuyersProps {
  onToast?: (message: string) => void;
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

const formatBudget = (min?: number | null, max?: number | null) => {
  if (min === undefined || min === null || max === undefined || max === null) return 'Not provided';
  return `₱${Math.round(min).toLocaleString()} – ₱${Math.round(max).toLocaleString()}`;
};

export const AdminBuyers: React.FC<AdminBuyersProps> = ({ onToast }) => {
  const [buyers, setBuyers] = useState<AdminBuyerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (message: string) => onToast?.(message);

  const loadBuyers = async (search = '') => {
    setError('');
    try {
      const data = await getBuyers(search);
      setBuyers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load buyer accounts right now.');
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadBuyers().finally(() => setIsLoading(false));
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await loadBuyers(searchQuery);
    setIsSyncing(false);
    showToast('Buyer records synced from the database.');
  };

  // Search is debounced client-side against the already-loaded list for
  // instant feedback, but also re-queries the server so results stay
  // correct if the list is large enough that not everything is loaded.
  const filteredBuyers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return buyers;
    return buyers.filter(
      (b) =>
        (b.fullName || '').toLowerCase().includes(query) ||
        (b.username || '').toLowerCase().includes(query) ||
        (b.email || '').toLowerCase().includes(query)
    );
  }, [buyers, searchQuery]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = buyers.filter((b) => {
      const created = new Date(b.registeredAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    const withPreferences = buyers.filter((b) => b.preferences !== null).length;

    return { total: buyers.length, withPreferences, thisMonth };
  }, [buyers]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Buyers', value: stats.total, icon: Users },
          { label: 'With Preferences', value: stats.withPreferences, icon: UserCheck },
          { label: 'Registered This Month', value: stats.thisMonth, icon: Calendar },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="admin-panel rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider">{stat.label}</p>
                <Icon className="w-4 h-4 text-emerald-700/70" />
              </div>
              <p className="text-[#2f2417] text-2xl font-bold mt-2">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[#2f2417] font-serif text-xl sm:text-2xl font-bold">Registered Buyer Profiles</h2>
          <p className="text-[#7c6a57] text-xs sm:text-sm mt-1">
            Read-only buyer accounts and preferences submitted through the Buyer Portal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-700/50 w-48 sm:w-64 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="admin-button-secondary flex items-center gap-1.5 px-3 py-2 text-[#5d503f] font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-60"
            title="Sync from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync DB
          </button>
        </div>
      </div>

      <div className="admin-panel rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <p className="text-[#7c6a57] text-sm">Loading buyer accounts...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button
              type="button"
              onClick={handleSync}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : filteredBuyers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-[#9d8c76] mx-auto mb-3" />
            <p className="text-[#7c6a57] text-sm">
              {searchQuery
                ? 'No buyer accounts match your search.'
                : 'No buyer accounts yet. Accounts will appear here after registration.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#d6c7b2] text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">
                  <th className="p-4">Buyer Full Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Intent</th>
                  <th className="p-4">Max Budget</th>
                  <th className="p-4">Preferred Sector / Location</th>
                  <th className="p-4">System Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded2c0]">
                {filteredBuyers.map((buyer) => (
                  <tr key={buyer.userId} className="transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-[#2f2417] text-sm">{buyer.fullName}</div>
                      <div className="text-[10px] text-[#7c6a57] mt-0.5">
                        @{buyer.username} · Registered {formatDate(buyer.registeredAt)}
                      </div>
                    </td>
                    <td className="p-4 text-[#5d503f] break-all">{buyer.email}</td>
                    <td className="p-4">
                      {buyer.preferences?.landType ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-md border bg-emerald-100 text-emerald-950 border-emerald-700/35">
                          {buyer.preferences.landType}
                        </span>
                      ) : (
                        <span className="text-[#9d8c76]">Not provided</span>
                      )}
                    </td>
                    <td className="p-4 text-[#5d503f]">
                      {buyer.preferences
                        ? formatBudget(buyer.preferences.budgetMin, buyer.preferences.budgetMax)
                        : 'Not provided'}
                    </td>
                    <td className="p-4 text-[#5d503f]">
                      {buyer.preferences?.location || 'Not provided'}
                    </td>
                    <td className="p-4 text-[#7c6a57]">
                      {buyer.preferences ? 'Registered via Buyer Portal' : 'No preferences submitted yet'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </>
  );
};

export default AdminBuyers;
