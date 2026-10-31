import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Handshake, Download, Loader2, Eye, Edit2, Ban } from 'lucide-react';
import type { Property } from '../../types/types';
import { getProperties } from '../../services/PropertyService';
import type { Transaction, TransactionStatus } from '../../services/TransactionService.ts';
import { getTransactions } from '../../services/TransactionService.ts';
import { TransactionFormModal } from '../../components/Admin/TransactionFormModal';
import { TransactionDetailModal } from '../../components/Admin/TransactionDetailModal';
import { TransactionEditModal } from '../../components/Admin/TransactionEditModal';
import { TransactionCancelModal } from '../../components/Admin/TransactionCancelModal';
import { TransactionCorrectionModal } from '../../components/Admin/TransactionCorrectionModal';
import { exportDataset } from '../../services/ExportService';

interface AdminTransactionsProps {
  onToast?: (message: string) => void;
  onDataChanged?: () => void;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

const STATUS_FILTERS: Array<'All' | TransactionStatus> = ['All', 'Reserved', 'Processing', 'Completed', 'Cancelled'];

const getStatusBadge = (status: TransactionStatus) => {
  const badgeClass =
    'inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-md border tracking-wide';
  switch (status) {
    case 'Reserved':
      return <span className={`${badgeClass} bg-amber-100 text-amber-950 border-amber-700/35`}>Reserved</span>;
    case 'Processing':
      return <span className={`${badgeClass} bg-teal-100 text-teal-950 border-teal-700/35`}>Processing</span>;
    case 'Completed':
      return <span className={`${badgeClass} bg-emerald-100 text-emerald-950 border-emerald-700/35`}>Completed</span>;
    case 'Cancelled':
      return <span className={`${badgeClass} bg-stone-200 text-stone-900 border-stone-500/40`}>Cancelled</span>;
  }
};

const getPropertyDisplay = (t: Transaction, propertyList: Property[]) => {
  const propId =
    t.propertyId?.id ||
    t.propertyId?._id ||
    (typeof t.propertyId === 'string' ? t.propertyId : '');

  const match = propId
    ? propertyList.find((p) => p.id === propId || (p as any)._id === propId)
    : null;

  const name =
    t.propertyId?.name ||
    t.propertyId?.title ||
    match?.name ||
    match?.title ||
    'Unknown property';

  const location = t.propertyId?.location || match?.location || '';

  return { name, location };
};

const getBuyerDisplay = (t: Transaction) => {
  const fullName = t.buyerId?.fullName || t.buyerId?.username || 'Unknown buyer';
  const email = t.buyerId?.email || '';
  return { fullName, email };
};

export const AdminTransactions: React.FC<AdminTransactionsProps> = ({ onToast, onDataChanged }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TransactionStatus>('All');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const showToast = (message: string) => onToast?.(message);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await exportDataset('transactions', 'csv');
      showToast('Transactions exported as CSV.');
    } catch {
      showToast('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadAll = async () => {
    setError('');
    try {
      const [transactionsData, propertiesData] = await Promise.all([
        getTransactions(),
        getProperties(),
      ]);
      setTransactions(transactionsData);
      setProperties(propertiesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transactions right now.');
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadAll().finally(() => setIsLoading(false));
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => statusFilter === 'All' || t.status === statusFilter)
      .filter((t) => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        const buyer = getBuyerDisplay(t);
        const prop = getPropertyDisplay(t, properties);
        return (
          t.reference.toLowerCase().includes(q) ||
          buyer.fullName.toLowerCase().includes(q) ||
          buyer.email.toLowerCase().includes(q) ||
          prop.name.toLowerCase().includes(q) ||
          prop.location.toLowerCase().includes(q)
        );
      });
  }, [transactions, statusFilter, searchQuery, properties]);

  const handleOpenDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalOpen(true);
  };

  const handleOpenEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditModalOpen(true);
  };

  const handleOpenCancel = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsCancelModalOpen(true);
  };
  const handleOpenCorrection = (transaction: Transaction) => { setSelectedTransaction(transaction); setIsCorrectionModalOpen(true); };

  const handleCreated = () => {
    showToast('Transaction created and property reserved.');
    loadAll();
    onDataChanged?.();
  };

  const handleUpdated = () => {
    showToast('Transaction updated successfully.');
    loadAll();
    onDataChanged?.();
  };

  const handleCancelled = () => {
    showToast('Transaction cancelled and property returned to Available.');
    loadAll();
    onDataChanged?.();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-input pl-10 pr-4 py-2 rounded-xl text-xs focus:outline-none focus:border-emerald-700/50 w-48 sm:w-64 transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="admin-button-secondary flex items-center gap-1.5 px-4 py-2 text-[#5d503f] font-bold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="admin-button flex items-center gap-1.5 px-4 py-2 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none hover:brightness-105"
          >
            <Plus className="w-4 h-4" />
            New Transaction
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
              statusFilter === s
                ? 'admin-button text-white border-none'
                : 'admin-button-secondary text-[#5d503f]'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="admin-panel rounded-2xl overflow-hidden">
        {isLoading && transactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#7c6a57] text-sm">Loading transactions...</p>
          </div>
        ) : error && transactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-red-500 text-sm mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                loadAll().finally(() => setIsLoading(false));
              }}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800">
                <p className="text-red-500 text-sm mb-2">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(true);
                    loadAll().finally(() => setIsLoading(false));
                  }}
                  className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer"
                >
                  Try Again
                </button>
              </div>
            )}
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <Handshake className="w-10 h-10 text-[#9d8c76] mx-auto mb-3" />
                <p className="text-[#7c6a57] text-sm">
                  {searchQuery || statusFilter !== 'All'
                    ? 'No transactions match your filters.'
                    : 'No transactions yet. Create one to get started.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#d6c7b2] text-[10px] font-bold uppercase tracking-wider text-[#7c6a57]">
                      <th className="p-4">Reference</th>
                      <th className="p-4">Buyer</th>
                      <th className="p-4">Property</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right min-w-[13rem]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#ded2c0]">
                    {filteredTransactions.map((t) => {
                      const buyer = getBuyerDisplay(t);
                      const prop = getPropertyDisplay(t, properties);
                      const isEligible = t.status === 'Reserved' || t.status === 'Processing';

                      return (
                        <tr key={t.id} className="transition-colors hover:bg-black/[0.015]">
                          <td className="p-4 font-mono font-bold text-[#7c6a57]">{t.reference}</td>
                          <td className="p-4">
                            <div className="font-bold text-[#2f2417]">{buyer.fullName}</div>
                            <div className="text-[10px] text-[#5d503f]">{buyer.email}</div>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-[#2f2417]">{prop.name}</div>
                            <div className="text-[10px] text-[#5d503f]">{prop.location}</div>
                          </td>
                          <td className="p-4 text-right font-mono font-bold text-[#2f2417]">
                            {formatPrice(t.amount)}
                          </td>
                          <td className="p-4">{getStatusBadge(t.status)}</td>
                          <td className="p-4 text-[#6f604d]">{formatDate(t.createdAt)}</td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(t)}
                                className="admin-button-secondary px-2.5 py-1 text-[#5d503f] rounded-lg hover:text-[#2f2417] transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              {isEligible && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(t)}
                                  className="admin-button-secondary px-2.5 py-1 text-[#2f4736] rounded-lg hover:text-[#1e3024] transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1"
                                  title="Edit Transaction"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-emerald-800" />
                                  Edit
                                </button>
                              )}
                              {t.status === 'Completed' && (
                                <button type="button" onClick={() => handleOpenCorrection(t)} className="admin-button-secondary px-2.5 py-1 text-amber-800 rounded-lg text-[11px] font-bold flex items-center gap-1" title="Correct Completed Transaction">
                                  <Edit2 className="w-3.5 h-3.5" /> Correct
                                </button>
                              )}
                              {isEligible && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCancel(t)}
                                  className="admin-button-secondary px-2.5 py-1 text-rose-700 hover:text-rose-900 border-rose-300 rounded-lg transition-colors cursor-pointer text-[11px] font-bold flex items-center gap-1"
                                  title="Cancel / Void Transaction"
                                >
                                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <TransactionFormModal
        isOpen={isCreateModalOpen}
        properties={properties}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      <TransactionDetailModal
        isOpen={isDetailModalOpen}
        transaction={selectedTransaction}
        properties={properties}
        onClose={() => setIsDetailModalOpen(false)}
        onEdit={handleOpenEdit}
        onCancel={handleOpenCancel}
        onCorrect={handleOpenCorrection}
        onUpdated={handleUpdated}
      />

      <TransactionEditModal
        isOpen={isEditModalOpen}
        transaction={selectedTransaction}
        properties={properties}
        onClose={() => setIsEditModalOpen(false)}
        onUpdated={handleUpdated}
      />

      <TransactionCancelModal
        isOpen={isCancelModalOpen}
        transaction={selectedTransaction}
        onClose={() => setIsCancelModalOpen(false)}
        onCancelled={handleCancelled}
      />
      <TransactionCorrectionModal isOpen={isCorrectionModalOpen} transaction={selectedTransaction} onClose={() => setIsCorrectionModalOpen(false)} onCorrected={() => { showToast('Completed transaction correction saved.'); loadAll(); onDataChanged?.(); }} />
    </>
  );
};

export default AdminTransactions;
