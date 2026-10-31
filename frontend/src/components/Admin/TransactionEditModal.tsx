import React, { useEffect, useMemo, useState } from 'react';
import { X, Edit2, Search, AlertCircle, Loader2 } from 'lucide-react';
import type { Property } from '../../types/types';
import type { AdminBuyerProfile } from '../../services/AdminBuyerService';
import { getBuyers } from '../../services/AdminBuyerService';
import type { Transaction, TransactionStatus, UpdateTransactionPayload } from '../../services/TransactionService';
import { updateTransaction } from '../../services/TransactionService';
import { CurrencyInput } from './CurrencyInput';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface TransactionEditModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  properties: Property[];
  onClose: () => void;
  onUpdated: () => void;
}

const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  Reserved: ['Processing', 'Completed', 'Cancelled'],
  Processing: ['Completed', 'Cancelled'],
  Completed: [],
  Cancelled: [],
};

const formatPrice = (num: number) => '₱' + Math.round(num).toLocaleString();

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  isOpen,
  transaction,
  properties,
  onClose,
  onUpdated,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [buyers, setBuyers] = useState<AdminBuyerProfile[]>([]);
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);

  const [buyerSearch, setBuyerSearch] = useState('');
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [amountManuallyEdited, setAmountManuallyEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('Reserved');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initial buyer ID from transaction
  const initialBuyerId = useMemo(() => {
    if (!transaction?.buyerId) return '';
    return transaction.buyerId.id || transaction.buyerId._id || '';
  }, [transaction]);

  // Initial property ID from transaction
  const initialPropertyId = useMemo(() => {
    if (!transaction?.propertyId) return '';
    return transaction.propertyId.id || transaction.propertyId._id || '';
  }, [transaction]);

  useEffect(() => {
    if (!isOpen || !transaction) return;
    setAmount(transaction.amount);
    setAmountManuallyEdited(false);
    setNotes(transaction.notes || '');
    setStatus(transaction.status);
    setSelectedBuyerId(initialBuyerId);
    setSelectedPropertyId(initialPropertyId);
    setBuyerSearch('');
    setPropertySearch('');
    setErrorMsg('');

    setIsLoadingBuyers(true);
    getBuyers()
      .then(setBuyers)
      .catch(() => setBuyers([]))
      .finally(() => setIsLoadingBuyers(false));
  }, [isOpen, transaction, initialBuyerId, initialPropertyId]);

  const filteredBuyers = useMemo(() => {
    const q = buyerSearch.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (b) =>
        b.fullName.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.username.toLowerCase().includes(q)
    );
  }, [buyers, buyerSearch]);

  const filteredProperties = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return properties
      .filter((p) => p.status !== 'Sold' || p.id === initialPropertyId)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
  }, [properties, propertySearch, initialPropertyId]);

  if (!isOpen || !transaction) return null;

  const allowedNextStatuses = ALLOWED_TRANSITIONS[transaction.status] || [];
  const isTerminal = allowedNextStatuses.length === 0;

  const isPropertyChanging =
    selectedPropertyId && selectedPropertyId !== initialPropertyId;
  const isBuyerChanging = selectedBuyerId && selectedBuyerId !== initialBuyerId;

  const currentPropertyName =
    transaction.propertyId?.name || transaction.propertyId?.title || 'Current Property';
  const newPropertyObj = properties.find((p) => p.id === selectedPropertyId);

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find((p) => p.id === propertyId);
    if (property && !amountManuallyEdited) setAmount(property.price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (amount === '' || Number(amount) <= 0) {
      setErrorMsg('Transaction amount must be greater than zero.');
      return;
    }

    if (!selectedBuyerId) {
      setErrorMsg('A valid buyer is required.');
      return;
    }

    if (!selectedPropertyId) {
      setErrorMsg('A valid property is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpdateTransactionPayload = {
        amount: Number(amount),
        notes: notes.trim(),
      };

      if (status !== transaction.status) {
        payload.status = status;
      }

      // Preserve existing buyer unless explicitly changed
      if (isBuyerChanging) {
        payload.buyerId = selectedBuyerId;
      }

      // Preserve existing property unless explicitly changed
      if (isPropertyChanging) {
        payload.propertyId = selectedPropertyId;
      }

      await updateTransaction(transaction.id, payload);
      onUpdated();
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not update transaction. Please review inputs and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-edit-modal-title"
        tabIndex={-1}
        className="admin-panel w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-emerald-800" />
            <h3 id="transaction-edit-modal-title" className="text-[#2f2417] font-serif text-lg font-bold">
              Edit Transaction {transaction.reference}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#5d503f] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {isTerminal ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
              This transaction is <strong>{transaction.status}</strong> (terminal state). Completed or cancelled records cannot be modified to preserve audit and transaction history.
            </div>
          ) : (
            <>
              {/* Buyer Selection */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                  Buyer Association
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search buyers by name or email..."
                    value={buyerSearch}
                    onChange={(e) => setBuyerSearch(e.target.value)}
                    className="admin-input w-full pl-9 pr-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 admin-panel-muted rounded-lg p-1.5 border border-[#d6c7b2]/70">
                  {isLoadingBuyers ? (
                    <p className="text-[10px] text-[#5d503f] p-2">Loading registered buyers...</p>
                  ) : filteredBuyers.length === 0 ? (
                    <p className="text-[10px] text-[#5d503f] p-2">No matching buyers found.</p>
                  ) : (
                    filteredBuyers.map((b) => (
                      <label
                        key={b.userId}
                        className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          selectedBuyerId === b.userId ? 'bg-emerald-500/15 font-bold' : 'hover:bg-black/5'
                        }`}
                      >
                        <input
                          type="radio"
                          name="editBuyer"
                          checked={selectedBuyerId === b.userId}
                          onChange={() => setSelectedBuyerId(b.userId)}
                          className="accent-emerald-600 cursor-pointer"
                        />
                        <span className="text-[#2f2417] truncate">{b.fullName}</span>
                        <span className="text-[#7c6a57] text-[10px] truncate">({b.email})</span>
                        {b.userId === initialBuyerId && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                            Current
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
                {isBuyerChanging && (
                  <p className="text-[10px] text-emerald-800 mt-1">
                    Buyer will be updated upon saving.
                  </p>
                )}
              </div>

              {/* Property Selection */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                  Property Association
                </label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search properties by name or location..."
                    value={propertySearch}
                    onChange={(e) => setPropertySearch(e.target.value)}
                    className="admin-input w-full pl-9 pr-3 py-2 rounded-lg text-xs"
                  />
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1 admin-panel-muted rounded-lg p-1.5 border border-[#d6c7b2]/70">
                  {filteredProperties.length === 0 ? (
                    <p className="text-[10px] text-[#5d503f] p-2">No matching properties found.</p>
                  ) : (
                    filteredProperties.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between gap-2 p-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                          selectedPropertyId === p.id ? 'bg-emerald-500/15 font-bold' : 'hover:bg-black/5'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <input
                            type="radio"
                            name="editProperty"
                            checked={selectedPropertyId === p.id}
                            onChange={() => handlePropertyChange(p.id)}
                            className="accent-emerald-600 cursor-pointer shrink-0"
                          />
                          <span className="text-[#2f2417] truncate">{p.name}</span>
                          <span className="text-[#7c6a57] text-[10px] truncate">{p.location}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-[#2f2417] text-[11px] font-bold">
                            {formatPrice(p.price)}
                          </span>
                          {p.id === initialPropertyId && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                              Current
                            </span>
                          )}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {isPropertyChanging && newPropertyObj && (
                  <div className="flex items-start gap-1.5 text-[10px] text-amber-800 bg-amber-50 p-2 rounded-lg mt-1.5 border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700" />
                    <span>
                      Changing property will release <strong>{currentPropertyName}</strong> back to Available and place <strong>{newPropertyObj.name}</strong> on Reserved.
                    </span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                  Transaction Amount (₱) <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  required
                  value={amount}
                  onChange={(value) => {
                    setAmount(value);
                    setAmountManuallyEdited(true);
                  }}
                  className="admin-input w-full px-3 py-2 rounded-lg text-xs"
                />
                {amountManuallyEdited ? (
                  <button type="button" onClick={() => { setAmount(newPropertyObj?.price ?? transaction.propertyId?.price ?? ''); setAmountManuallyEdited(false); }} className="text-[10px] text-emerald-700 mt-1 underline cursor-pointer">
                    Reset to Listing Price
                  </button>
                ) : (
                  <p className="text-[10px] text-emerald-700 mt-1">Saved transaction amount.</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                  Status Transition
                </label>
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
                {status === 'Completed' && status !== transaction.status && (
                  <p className="text-[10px] text-emerald-700 mt-1">
                    Marking Completed will finalize the deal and mark the property as <strong>Sold</strong>.
                  </p>
                )}
                {status === 'Cancelled' && status !== transaction.status && (
                  <p className="text-[10px] text-amber-700 mt-1">
                    Cancelling will void this transaction and return the property to <strong>Available</strong>.
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1">
                  Transaction Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add administrative notes, terms, or remarks..."
                  className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none"
                />
              </div>
            </>
          )}

          {errorMsg && <p className="text-red-600 text-xs font-semibold">{errorMsg}</p>}

          <div className="pt-2 flex justify-end gap-3 border-t border-[#ded2c0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
            >
              Cancel
            </button>
            {!isTerminal && (
              <button
                type="submit"
                disabled={isSaving}
                className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionEditModal;
