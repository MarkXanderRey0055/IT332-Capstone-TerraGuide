import React, { useEffect, useState } from 'react';
import { X, Handshake, ShieldCheck, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { Property } from '../../types/types';
import type { Transaction, TransactionStatus } from '../../services/TransactionService';
import { updateTransaction } from '../../services/TransactionService';
import { AuditModal } from './AuditModal';

interface TransactionDetailModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  properties: Property[];
  onClose: () => void;
  onUpdated: () => void;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

// Mirrors the backend's transition table exactly — restricting the picker
// to valid next states is just a UX nicety, the server is still the real
// authority and will reject anything outside this table regardless.
const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  Reserved: ['Processing', 'Completed', 'Cancelled'],
  Processing: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

const getDocIcon = (status: 'pending' | 'verified' | 'missing' | undefined) => {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    case 'missing':
      return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-amber-400" />;
  }
};

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  transaction,
  properties,
  onClose,
  onUpdated,
}) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('Reserved');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  useEffect(() => {
    if (transaction) {
      setAmount(transaction.amount.toString());
      setNotes(transaction.notes);
      setStatus(transaction.status);
      setErrorMsg('');
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  // The transaction's populated propertyId only carries a subset of
  // fields — resolve the full Property record (for documents/compliance)
  // from the list AdminTransactions already loaded, rather than fetching
  // it again or duplicating property fields onto the transaction.
  const fullProperty = transaction.propertyId
    ? properties.find((p) => p.id === transaction.propertyId!.id) ?? null
    : null;

  const allowedNextStatuses = ALLOWED_TRANSITIONS[transaction.status];
  const isTerminal = allowedNextStatuses.length === 0;

  const handleSave = async () => {
    setErrorMsg('');
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      setErrorMsg('Enter a valid transaction amount.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: { amount?: number; notes?: string; status?: TransactionStatus } = {
        amount: amountNum,
        notes: notes.trim(),
      };
      if (status !== transaction.status) {
        payload.status = status;
      }
      await updateTransaction(transaction.id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update this transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="admin-panel w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
            <div>
              <h3 className="text-[#2f2417] font-serif text-lg font-bold flex items-center gap-2">
                <Handshake className="w-4 h-4 text-emerald-700" />
                {transaction.reference}
              </h3>
              <p className="text-[10px] text-[#9d8c76] mt-0.5">Created {formatDate(transaction.createdAt)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[#8f7d69] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Buyer & property summary — read-only, these are existing records */}
            <div className="grid grid-cols-2 gap-3">
              <div className="admin-panel-muted rounded-lg p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#9d8c76] mb-1">Buyer</p>
                <p className="text-xs font-bold text-[#2f2417] truncate">{transaction.buyerId?.fullName ?? 'Unknown buyer'}</p>
                <p className="text-[10px] text-[#7c6a57] truncate">{transaction.buyerId?.email ?? ''}</p>
              </div>
              <div className="admin-panel-muted rounded-lg p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#9d8c76] mb-1">Property</p>
                <p className="text-xs font-bold text-[#2f2417] truncate">{transaction.propertyId?.name ?? 'Unknown property'}</p>
                <p className="text-[10px] text-[#7c6a57] truncate">{transaction.propertyId?.location ?? ''}</p>
              </div>
            </div>

            {/* Property compliance snapshot — reuses existing document data, doesn't recompute it */}
            {fullProperty?.documents && (
              <div className="admin-panel-muted rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#9d8c76] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Compliance Snapshot
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAuditModalOpen(true)}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-transparent border-none cursor-pointer"
                  >
                    View Full Audit
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-[#5d503f]">
                  <span className="flex items-center gap-1">{getDocIcon(fullProperty.documents.deed)} Deed</span>
                  <span className="flex items-center gap-1">{getDocIcon(fullProperty.documents.tax)} Tax Dec</span>
                  <span className="flex items-center gap-1">{getDocIcon(fullProperty.documents.survey)} Survey</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                Transaction Amount (₱)
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isTerminal}
                className="admin-input w-full px-3 py-2 rounded-lg text-xs disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isTerminal}
                className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                Status
              </label>
              {isTerminal ? (
                <p className="text-xs text-[#7c6a57] admin-panel-muted rounded-lg px-3 py-2">
                  {transaction.status} — this transaction is final and can no longer be changed.
                </p>
              ) : (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TransactionStatus)}
                  className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                >
                  <option value={transaction.status}>{transaction.status} (current)</option>
                  {allowedNextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {status === 'Completed' && status !== transaction.status && (
                <p className="text-[10px] text-emerald-700 mt-1.5">
                  Marking this Completed will set the property to Sold.
                </p>
              )}
              {status === 'Cancelled' && status !== transaction.status && (
                <p className="text-[10px] text-amber-700 mt-1.5">
                  Cancelling will return the property to Available.
                </p>
              )}
            </div>

            {errorMsg && <p className="text-red-500 text-xs">{errorMsg}</p>}

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
              >
                Close
              </button>
              {!isTerminal && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AuditModal
        isOpen={isAuditModalOpen}
        property={fullProperty}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </>
  );
};

export default TransactionDetailModal;
