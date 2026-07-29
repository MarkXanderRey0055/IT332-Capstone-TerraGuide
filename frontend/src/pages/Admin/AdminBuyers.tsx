import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Trash2,
  Eye,
  Users,
  UserCheck,
  Calendar,
  X,
  Mail,
  User,
} from 'lucide-react';
import type { BuyerAccount } from '../../services/buyerAccounts';
import { loadBuyerAccounts, removeBuyerAccount } from '../../services/buyerAccounts';
import {
  loadAllBuyerPreferences,
  loadBuyerPreferencesLegacy,
  removeBuyerPreferencesLegacy,
} from '../../services/legacyBuyerPreferences';
import type { BuyerPreferences } from '../../types/types';

interface AdminBuyersProps {
  onToast?: (message: string) => void;
}

const formatDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatBudget = (amount: number) => `₱${Math.round(amount).toLocaleString()}`;

const getBuyerPreferences = (account: BuyerAccount): BuyerPreferences | null => {
  return loadBuyerPreferencesLegacy(account.username) ?? loadBuyerPreferencesLegacy(account.email);
};

export const AdminBuyers: React.FC<AdminBuyersProps> = ({ onToast }) => {
  const [buyers, setBuyers] = useState<BuyerAccount[]>(() => loadBuyerAccounts());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerAccount | null>(null);

  const showToast = (message: string) => {
    onToast?.(message);
  };

  const refreshBuyers = () => {
    setBuyers(loadBuyerAccounts());
  };

  useEffect(() => {
    const syncBuyers = (event: StorageEvent) => {
      if (event.key === 'terraguide_buyers' || event.key === null) {
        refreshBuyers();
      }
    };

    window.addEventListener('storage', syncBuyers);
    return () => window.removeEventListener('storage', syncBuyers);
  }, []);

  const filteredBuyers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return buyers;

    return buyers.filter(
      (buyer) =>
        buyer.username.toLowerCase().includes(query) ||
        buyer.email.toLowerCase().includes(query),
    );
  }, [buyers, searchQuery]);

  const stats = useMemo(() => {
    const allPrefs = loadAllBuyerPreferences();
    const now = new Date();
    const thisMonth = buyers.filter((buyer) => {
      const created = new Date(buyer.id);
      return (
        created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()
      );
    }).length;

    const withPreferences = buyers.filter((buyer) =>
      allPrefs.some(
        (pref: any) =>
          pref.userId.toLowerCase() === buyer.username.toLowerCase() ||
          pref.userId.toLowerCase() === buyer.email.toLowerCase(),
      ),
    ).length;

    return {
      total: buyers.length,
      withPreferences,
      thisMonth,
    };
  }, [buyers]);

  const handleDeleteBuyer = (buyer: BuyerAccount) => {
    if (
      !confirm(
        `Delete buyer account "${buyer.username}"? This will also remove their saved preferences.`,
      )
    ) {
      return;
    }

    removeBuyerAccount(buyer.id);
    removeBuyerPreferencesLegacy(buyer.username);
    removeBuyerPreferencesLegacy(buyer.email);
    refreshBuyers();
    if (selectedBuyer?.id === buyer.id) {
      setSelectedBuyer(null);
    }
    showToast(`Deleted buyer account "${buyer.username}"`);
  };

  const handleViewBuyer = (buyer: BuyerAccount) => {
    setSelectedBuyer(buyer);
  };

  const selectedPrefs = selectedBuyer ? getBuyerPreferences(selectedBuyer) : null;

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
            <div
              key={stat.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs uppercase tracking-wider">{stat.label}</p>
                <Icon className="w-4 h-4 text-emerald-400/70" />
              </div>
              <p className="text-white text-2xl font-bold mt-2">{stat.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-serif text-xl sm:text-2xl font-bold">Buyer Accounts</h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            View and manage accounts created through the buyer registration portal.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500/50 w-56 sm:w-72 transition-all"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        {filteredBuyers.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {searchQuery
                ? 'No buyer accounts match your search.'
                : 'No buyer accounts yet. Accounts will appear here after registration.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="p-4">Username</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Registered</th>
                  <th className="p-4">Preferences</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filteredBuyers.map((buyer) => {
                  const prefs = getBuyerPreferences(buyer);
                  return (
                    <tr key={buyer.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white text-sm">{buyer.username}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">ID: {buyer.id}</div>
                      </td>
                      <td className="p-4 text-gray-300">{buyer.email}</td>
                      <td className="p-4 text-gray-400">{formatDate(buyer.id)}</td>
                      <td className="p-4">
                        {prefs ? (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">
                            Configured
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-500/15 text-neutral-400">
                            Not Set
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewBuyer(buyer)}
                            className="p-1.5 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 rounded-lg border border-white/[0.08] hover:text-white transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBuyer(buyer)}
                            className="p-1.5 bg-white/[0.04] hover:bg-red-950/20 text-gray-400 rounded-lg border border-white/[0.08] hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBuyer && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#112a1d] shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h3 className="text-white font-serif text-lg font-bold">Buyer Details</h3>
              <button
                type="button"
                onClick={() => setSelectedBuyer(null)}
                aria-label="Close"
                className="text-gray-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-wider font-bold">
                    <User className="w-3.5 h-3.5" />
                    Username
                  </div>
                  <p className="text-white text-sm font-semibold mt-2">{selectedBuyer.username}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-wider font-bold">
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </div>
                  <p className="text-white text-sm font-semibold mt-2 break-all">{selectedBuyer.email}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Registered On</p>
                <p className="text-white text-sm font-semibold mt-2">{formatDate(selectedBuyer.id)}</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold mb-3">
                  Saved Preferences
                </p>
                {selectedPrefs ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Budget Range</p>
                      <p className="text-white font-medium mt-1">
                        {formatBudget(selectedPrefs.budgetMin)} – {formatBudget(selectedPrefs.budgetMax)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Land Type</p>
                      <p className="text-white font-medium mt-1">{selectedPrefs.landType || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Intended Use</p>
                      <p className="text-white font-medium mt-1">{selectedPrefs.intendedUse || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Preferred Location</p>
                      <p className="text-white font-medium mt-1">{selectedPrefs.location || '—'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Minimum Lot Size</p>
                      <p className="text-white font-medium mt-1">
                        {selectedPrefs.minLotSize ? `${selectedPrefs.minLotSize.toLocaleString()} sqm` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Last Updated</p>
                      <p className="text-white font-medium mt-1">{formatDate(selectedPrefs.timestamp)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">This buyer has not saved preferences yet.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedBuyer(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-300 border border-white/[0.08] hover:bg-white/[0.04] transition-colors cursor-pointer bg-transparent"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBuyer(selectedBuyer)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-red-300 border border-red-500/20 hover:bg-red-950/20 transition-colors cursor-pointer bg-transparent"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};