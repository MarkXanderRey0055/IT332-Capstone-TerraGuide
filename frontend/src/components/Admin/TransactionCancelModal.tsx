import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import type { Transaction } from '../../services/TransactionService';
import { updateTransaction } from '../../services/TransactionService';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface TransactionCancelModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onCancelled: () => void;
}

export const TransactionCancelModal: React.FC<TransactionCancelModalProps> = ({
  isOpen,
  transaction,
  onClose,
  onCancelled,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !transaction) return null;

  const buyerName =
    transaction.buyerId?.fullName || transaction.buyerId?.username || 'Unknown buyer';
  const propertyName =
    transaction.propertyId?.name || transaction.propertyId?.title || 'Unknown property';

  const handleConfirmCancel = async () => {
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      const reasonTrimmed = cancellationReason.trim();
      let updatedNotes = transaction.notes || '';
      if (reasonTrimmed) {
        const timestamp = new Date().toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        const cancellationNote = `[Cancelled on ${timestamp}: ${reasonTrimmed}]`;
        updatedNotes = updatedNotes ? `${updatedNotes}\n${cancellationNote}` : cancellationNote;
      }

      await updateTransaction(transaction.id, {
        status: 'Cancelled',
        notes: updatedNotes,
      });

      onCancelled();
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not cancel this transaction. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[550] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        tabIndex={-1}
        className="admin-panel w-full max-w-md rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2] bg-amber-50/60">
          <div className="flex items-center gap-2 text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <h3 id="cancel-modal-title" className="font-serif text-base font-bold text-[#2f2417]">
              Cancel / Void Transaction
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="text-[#5d503f] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-xs">
          <p className="text-[#3d3225]">
            Are you sure you want to cancel and void{' '}
            <span className="font-mono font-bold text-[#2f2417]">{transaction.reference}</span>?
          </p>

          <div className="admin-panel-muted rounded-xl p-3 space-y-1.5 border border-[#d6c7b2]/70">
            <div className="flex justify-between">
              <span className="text-[#7c6a57] font-medium">Buyer:</span>
              <span className="font-bold text-[#2f2417]">{buyerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7c6a57] font-medium">Property:</span>
              <span className="font-bold text-[#2f2417]">{propertyName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#7c6a57] font-medium">Current Status:</span>
              <span className="font-bold text-amber-800">{transaction.status}</span>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
            <p className="font-bold">Important record notice:</p>
            <ul className="list-disc list-inside space-y-0.5 text-[#5d4a32]">
              <li>The transaction record is <strong>never deleted</strong> and remains in history.</li>
              <li>Its status will permanently transition to <strong>Cancelled</strong>.</li>
              <li>The property reservation will be released and set to <strong>Available</strong>.</li>
            </ul>
          </div>

          <div>
            <label
              htmlFor="cancellation-reason"
              className="text-[10px] uppercase tracking-wider font-bold text-[#7c6a57] block mb-1"
            >
              Reason for Cancellation <span className="text-[#5d503f] normal-case font-normal">(optional)</span>
            </label>
            <textarea
              id="cancellation-reason"
              rows={2}
              placeholder="e.g., Buyer withdrew reservation, financing declined..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              disabled={isSubmitting}
              className="admin-input w-full px-3 py-2 rounded-lg text-xs resize-none"
            />
          </div>

          {errorMsg && <p className="text-red-600 text-xs font-semibold">{errorMsg}</p>}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#ded2c0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer bg-transparent"
            >
              Keep Transaction
            </button>
            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 transition-all cursor-pointer border-none shadow-sm flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isSubmitting ? 'Cancelling...' : 'Confirm Void / Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionCancelModal;
