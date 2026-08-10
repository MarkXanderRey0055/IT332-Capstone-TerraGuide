import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Trash2,
  Edit2,
  Plus,
  Users,
  UserCheck,
  Calendar,
  X,
  RefreshCw,
} from 'lucide-react';
import type { AdminBuyerProfile, CreateBuyerPayload, UpdateBuyerPayload } from '../../services/AdminBuyerService';
import { getBuyers, createBuyer, updateBuyer, deleteBuyer } from '../../services/AdminBuyerService';
import { ApiError } from '../../utils/api';

interface AdminBuyersProps {
  onToast?: (message: string) => void;
}

// Same enum values as the backend BuyerPreference schema — keeping the
// dropdowns in sync with what the server will actually accept.
const LAND_TYPES = ['Residential', 'Commercial', 'Agricultural', 'Condominium', 'House & Lot'];
const INTENDED_USES = ['Primary Residence', 'Investment', 'Business', 'Farming', 'Vacation Home'];

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

const formatBudget = (min?: number, max?: number) => {
  if (min === undefined || max === undefined) return 'Not provided';
  return `₱${Math.round(min).toLocaleString()} – ₱${Math.round(max).toLocaleString()}`;
};

type BuyerFormState = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  address: string;
  landType: string;
  intendedUse: string;
  budgetMin: string;
  budgetMax: string;
  location: string;
  minLotSize: string;
};

const emptyForm: BuyerFormState = {
  fullName: '',
  username: '',
  email: '',
  password: '',
  address: '',
  landType: '',
  intendedUse: '',
  budgetMin: '',
  budgetMax: '',
  location: '',
  minLotSize: '',
};

export const AdminBuyers: React.FC<AdminBuyersProps> = ({ onToast }) => {
  const [buyers, setBuyers] = useState<AdminBuyerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedBuyer, setSelectedBuyer] = useState<AdminBuyerProfile | null>(null);
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [formState, setFormState] = useState<BuyerFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        b.fullName.toLowerCase().includes(query) ||
        b.username.toLowerCase().includes(query) ||
        b.email.toLowerCase().includes(query)
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

  const openAddForm = () => {
    setFormState(emptyForm);
    setFormError('');
    setFormMode('add');
  };

  const openEditForm = (buyer: AdminBuyerProfile) => {
    setSelectedBuyer(buyer);
    setFormState({
      fullName: buyer.fullName,
      username: buyer.username,
      email: buyer.email,
      password: '',
      address: buyer.address,
      landType: buyer.preferences?.landType ?? '',
      intendedUse: buyer.preferences?.intendedUse ?? '',
      budgetMin: buyer.preferences?.budgetMin?.toString() ?? '',
      budgetMax: buyer.preferences?.budgetMax?.toString() ?? '',
      location: buyer.preferences?.location ?? '',
      minLotSize: buyer.preferences?.minLotSize?.toString() ?? '',
    });
    setFormError('');
    setFormMode('edit');
  };

  const closeForm = () => {
    setFormMode(null);
    setSelectedBuyer(null);
    setFormError('');
  };

  const handleFormChange = (field: keyof BuyerFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (formMode === 'add') {
        const payload: CreateBuyerPayload = {
          username: formState.username.trim(),
          email: formState.email.trim(),
          password: formState.password,
          fullName: formState.fullName.trim(),
          address: formState.address.trim(),
        };
        // Preference fields are only included if the admin actually filled
        // them in — leaving them out means "no preferences set yet".
        if (formState.landType) payload.landType = formState.landType;
        if (formState.intendedUse) payload.intendedUse = formState.intendedUse;
        if (formState.budgetMin) payload.budgetMin = Number(formState.budgetMin);
        if (formState.budgetMax) payload.budgetMax = Number(formState.budgetMax);
        if (formState.location) payload.location = formState.location.trim();
        if (formState.minLotSize) payload.minLotSize = Number(formState.minLotSize);

        await createBuyer(payload);
        showToast(`Buyer account "${payload.username}" created.`);
      } else if (formMode === 'edit' && selectedBuyer) {
        const payload: UpdateBuyerPayload = {
          fullName: formState.fullName.trim(),
          email: formState.email.trim(),
          address: formState.address.trim(),
        };
        if (formState.landType) payload.landType = formState.landType;
        if (formState.intendedUse) payload.intendedUse = formState.intendedUse;
        if (formState.budgetMin) payload.budgetMin = Number(formState.budgetMin);
        if (formState.budgetMax) payload.budgetMax = Number(formState.budgetMax);
        if (formState.location) payload.location = formState.location.trim();
        if (formState.minLotSize) payload.minLotSize = Number(formState.minLotSize);

        await updateBuyer(selectedBuyer.userId, payload);
        showToast(`Buyer profile "${selectedBuyer.username}" updated.`);
      }

      closeForm();
      await loadBuyers(searchQuery);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBuyer = async (buyer: AdminBuyerProfile) => {
    if (!confirm(`Delete buyer account "${buyer.fullName}"? This will also remove their saved preferences.`)) {
      return;
    }

    try {
      await deleteBuyer(buyer.userId);
      showToast(`Deleted buyer account "${buyer.fullName}".`);
      await loadBuyers(searchQuery);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not delete this buyer account.');
    }
  };

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
            Individual buyer accounts and their saved preferences from the Buyer Portal.
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
          <button
            type="button"
            onClick={openAddForm}
            className="admin-button flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none hover:brightness-105"
          >
            <Plus className="w-4 h-4" />
            Add Buyer
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
                  <th className="p-4 text-right">Actions</th>
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
                      {buyer.preferences ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">
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
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(buyer)}
                          className="admin-button-secondary p-1.5 text-[#5d503f] rounded-lg hover:text-[#2f2417] transition-colors cursor-pointer"
                          title="Edit Buyer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBuyer(buyer)}
                          className="admin-button-secondary p-1.5 text-[#7c6a57] rounded-lg hover:text-red-700 transition-colors cursor-pointer"
                          title="Delete Buyer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="admin-panel w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
              <h3 className="text-[#2f2417] font-serif text-lg font-bold">
                {formMode === 'add' ? 'Add Buyer' : 'Edit Buyer'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close"
                className="text-[#8f7d69] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Full Name" required>
                  <input
                    type="text"
                    required
                    value={formState.fullName}
                    onChange={(e) => handleFormChange('fullName', e.target.value)}
                    className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                  />
                </FormField>
                <FormField label="Email" required>
                  <input
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                  />
                </FormField>

                {formMode === 'add' && (
                  <>
                    <FormField label="Username" required>
                      <input
                        type="text"
                        required
                        value={formState.username}
                        onChange={(e) => handleFormChange('username', e.target.value)}
                        className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                      />
                    </FormField>
                    <FormField label="Password" required>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={formState.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                      />
                    </FormField>
                  </>
                )}

                <FormField label="Address" required>
                  <input
                    type="text"
                    required
                    value={formState.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                  />
                </FormField>
              </div>

              <div className="pt-2 border-t border-[#d6c7b2]">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] mb-3">
                  Preferences (optional)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Property Type">
                    <select
                      value={formState.landType}
                      onChange={(e) => handleFormChange('landType', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    >
                      <option value="">Not set</option>
                      {LAND_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Intended Use">
                    <select
                      value={formState.intendedUse}
                      onChange={(e) => handleFormChange('intendedUse', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    >
                      <option value="">Not set</option>
                      {INTENDED_USES.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Min Budget (₱)">
                    <input
                      type="number"
                      min={0}
                      value={formState.budgetMin}
                      onChange={(e) => handleFormChange('budgetMin', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </FormField>
                  <FormField label="Max Budget (₱)">
                    <input
                      type="number"
                      min={0}
                      value={formState.budgetMax}
                      onChange={(e) => handleFormChange('budgetMax', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </FormField>
                  <FormField label="Preferred Location">
                    <input
                      type="text"
                      value={formState.location}
                      onChange={(e) => handleFormChange('location', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </FormField>
                  <FormField label="Min Lot Size (sqm)">
                    <input
                      type="number"
                      min={0}
                      value={formState.minLotSize}
                      onChange={(e) => handleFormChange('minLotSize', e.target.value)}
                      className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </FormField>
                </div>
              </div>

              {formError && <p className="text-red-500 text-xs">{formError}</p>}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeForm}
                  className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : formMode === 'add' ? 'Create Buyer' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label,
  required,
  children,
}) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

export default AdminBuyers;