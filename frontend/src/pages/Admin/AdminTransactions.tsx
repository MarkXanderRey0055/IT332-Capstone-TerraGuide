import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Handshake } from 'lucide-react';
import type { Property } from '../../types/types';
import { getProperties } from '../../services/PropertyService';
import type { Transaction, TransactionStatus } from '../../services/TransactionService.ts';
import { getTransactions } from '../../services/TransactionService.ts';
import { TransactionFormModal } from '../../components/Admin/TransactionFormModal';
import { TransactionDetailModal } from '../../components/Admin/TransactionDetailModal';

interface AdminTransactionsProps {
  onToast?: (message: string) => void;
}

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

const STATUS_FILTERS: Array<'All' | TransactionStatus> = ['All', 'Reserved', 'Processing', 'Completed', 'Cancelled'];

const getStatusBadge = (status: TransactionStatus) => {
  switch (status) {
    case 'Reserved':
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/15 text-amber-400">Reserved</span>;
    case 'Processing':
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-teal-500/15 text-teal-400">Processing</span>;
    case 'Completed':
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">Completed</span>;
    case 'Cancelled':
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-neutral-500/15 text-neutral-400">Cancelled</span>;
  }
};

export const AdminTransactions: React.FC<AdminTransactionsProps> = ({ onToast }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TransactionStatus>('All');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const showToast = (message: string) => onToast?.(message);

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
        const buyerName = t.buyerId?.fullName?.toLowerCase() || '';
        const propertyName = t.propertyId?.name?.toLowerCase() || '';
        return (
          t.reference.toLowerCase().includes(q) ||
          buyerName.includes(q) ||
          propertyName.includes(q)
        );
      });
  }, [transactions, statusFilter, searchQuery]);

  const handleOpenDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailModalOpen(true);
  };

  const handleCreated = () => {
    showToast('Transaction created and property reserved.');
    loadAll();
  };

  const handleUpdated = () => {
    showToast('Transaction updated.');
    loadAll();
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[#2f2417] font-serif text-xl sm:text-2xl font-bold">Transaction Management</h2>
          <p className="text-[#7c6a57] text-xs sm:text-sm mt-1">
            Track deals from reservation through to a completed sale.
          </p>
        </div>

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
        {isLoading ? (
          <div className="p-12 text-center">
            <p className="text-[#7c6a57] text-sm">Loading transactions...</p>
          </div>
        ) : error ? (
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
        ) : filteredTransactions.length === 0 ? (
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
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ded2c0]">
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="transition-colors">
                    <td className="p-4 font-mono font-bold text-[#7c6a57]">{t.reference}</td>
                    <td className="p-4">
                      <div className="font-bold text-[#2f2417]">{t.buyerId?.fullName ?? 'Unknown buyer'}</div>
                      <div className="text-[10px] text-[#9d8c76]">{t.buyerId?.email ?? ''}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[#2f2417]">{t.propertyId?.name ?? 'Unknown property'}</div>
                      <div className="text-[10px] text-[#9d8c76]">{t.propertyId?.location ?? ''}</div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-[#2f2417]">{formatPrice(t.amount)}</td>
                    <td className="p-4">{getStatusBadge(t.status)}</td>
                    <td className="p-4 text-[#6f604d]">{formatDate(t.createdAt)}</td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(t)}
                        className="admin-button-secondary px-3 py-1.5 text-[#5d503f] rounded-lg hover:text-[#2f2417] transition-colors cursor-pointer text-[11px] font-bold"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        onUpdated={handleUpdated}
      />
    </>
  );
};

export default AdminTransactions;
