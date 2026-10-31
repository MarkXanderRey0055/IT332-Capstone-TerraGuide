import React, { useState } from 'react';
import {
  X,
  Handshake,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Edit2,
  Ban,
  User,
  Home,
  Calendar,
  FileText,
  DollarSign,
} from 'lucide-react';
import type { Property } from '../../types/types';
import type { Transaction, TransactionStatus } from '../../services/TransactionService';
import { AuditModal } from './AuditModal';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

interface TransactionDetailModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  properties: Property[];
  onClose: () => void;
  onEdit?: (transaction: Transaction) => void;
  onCancel?: (transaction: Transaction) => void;
  onCorrect?: (transaction: Transaction) => void;
  onUpdated?: () => void;
}

const formatPrice = (num?: number | null) =>
  num !== undefined && num !== null ? '₱' + Math.round(num).toLocaleString() : '—';

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getStatusBadge = (status: TransactionStatus) => {
  const badgeClass =
    'inline-flex items-center px-2.5 py-1 text-[11px] font-bold rounded-md border tracking-wide';
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

const getDocIcon = (status: 'pending' | 'verified' | 'missing' | undefined) => {
  switch (status) {
    case 'verified':
      return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    case 'missing':
      return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
    default:
      return <Clock className="w-3.5 h-3.5 text-amber-600" />;
  }
};

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  transaction,
  properties,
  onClose,
  onEdit,
  onCancel,
  onCorrect,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  if (!isOpen || !transaction) return null;

  // Resolve property reference accurately across id, _id, or full list lookup
  const propId =
    transaction.propertyId?.id ||
    transaction.propertyId?._id ||
    (typeof transaction.propertyId === 'string' ? transaction.propertyId : '');

  const fullProperty = propId
    ? properties.find((p) => p.id === propId || (p as any)._id === propId) ?? null
    : null;

  const propertyName =
    transaction.propertyId?.name ||
    transaction.propertyId?.title ||
    fullProperty?.name ||
    fullProperty?.title ||
    'Unknown property';

  const propertyLocation =
    transaction.propertyId?.location || fullProperty?.location || 'Location not specified';

  const propertyType =
    transaction.propertyId?.type || fullProperty?.type || 'Listing';

  const propertyListedPrice =
    transaction.propertyId?.price || fullProperty?.price || null;

  const buyerFullName =
    transaction.buyerId?.fullName || transaction.buyerId?.username || 'Unknown buyer';
  const buyerEmail = transaction.buyerId?.email || '';
  const buyerUsername = transaction.buyerId?.username || '';

  const creatorName =
    transaction.createdBy?.fullName || transaction.createdBy?.username || 'Administrator';

  const isEligibleForActions =
    transaction.status === 'Reserved' || transaction.status === 'Processing';

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="transaction-detail-modal-title"
          tabIndex={-1}
          className="admin-panel w-full max-w-2xl rounded-2xl max-h-[92vh] overflow-y-auto"
          style={{ boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#d6c7b2]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Handshake className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    id="transaction-detail-modal-title"
                    className="text-[#2f2417] font-serif text-lg font-bold"
                  >
                    {transaction.reference}
                  </h3>
                  {getStatusBadge(transaction.status)}
                </div>
                <p className="text-[11px] text-[#7c6a57] mt-0.5">
                  Initiated on {formatDateTime(transaction.createdAt)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-[#5d503f] hover:text-[#2f2417] transition-colors bg-transparent border-none cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Associated Entities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Buyer Card */}
              <div className="admin-panel-muted rounded-xl p-3.5 border border-[#d6c7b2]/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#5d503f] mb-1">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Associated Buyer
                  </span>
                </div>
                <p className="text-sm font-bold text-[#2f2417]">{buyerFullName}</p>
                {buyerEmail && (
                  <p className="text-xs text-[#5d503f]">
                    <span className="text-[#7c6a57]">Email:</span> {buyerEmail}
                  </p>
                )}
                {buyerUsername && (
                  <p className="text-xs text-[#5d503f]">
                    <span className="text-[#7c6a57]">Account:</span> @{buyerUsername}
                  </p>
                )}
              </div>

              {/* Property Card */}
              <div className="admin-panel-muted rounded-xl p-3.5 border border-[#d6c7b2]/70 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#5d503f] mb-1">
                  <Home className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Associated Property
                  </span>
                </div>
                <p className="text-sm font-bold text-[#2f2417]">{propertyName}</p>
                <p className="text-xs text-[#5d503f]">{propertyLocation}</p>
                <div className="flex items-center justify-between pt-1 border-t border-[#d6c7b2]/50 text-[11px]">
                  <span className="text-[#7c6a57]">Type: {propertyType}</span>
                  {propertyListedPrice && (
                    <span className="font-mono font-bold text-[#2f2417]">
                      Listing: {formatPrice(propertyListedPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Financial & Status Summary */}
            <div className="admin-panel-muted rounded-xl p-4 border border-[#d6c7b2]/70">
              <div className="flex items-center gap-1.5 text-[#5d503f] mb-3">
                <DollarSign className="w-4 h-4 text-emerald-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Transaction Financials & Terms
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-[#7c6a57] uppercase tracking-wider font-semibold">
                    Transaction Amount
                  </p>
                  <p className="text-base font-mono font-bold text-emerald-900 mt-0.5">
                    {formatPrice(transaction.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#7c6a57] uppercase tracking-wider font-semibold">
                    Current Status
                  </p>
                  <div className="mt-1">{getStatusBadge(transaction.status)}</div>
                </div>
                <div>
                  <p className="text-[10px] text-[#7c6a57] uppercase tracking-wider font-semibold">
                    Recorded By
                  </p>
                  <p className="text-xs font-bold text-[#2f2417] mt-1">{creatorName}</p>
                </div>
              </div>
            </div>

            {/* Timeline & Audit Info */}
            <div className="admin-panel-muted rounded-xl p-3.5 border border-[#d6c7b2]/70 space-y-2">
              <div className="flex items-center gap-1.5 text-[#5d503f]">
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Record Timeline & History
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[#7c6a57] block">Created Date</span>
                  <span className="font-medium text-[#2f2417]">
                    {formatDateTime(transaction.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7c6a57] block">Last Updated</span>
                  <span className="font-medium text-[#2f2417]">
                    {formatDateTime(transaction.updatedAt || transaction.createdAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#7c6a57] block">Completed At</span>
                  <span className="font-medium text-[#2f2417]">
                    {transaction.completedAt ? formatDateTime(transaction.completedAt) : 'Not finalized'}
                  </span>
                </div>
              </div>
            </div>

            {/* Property Compliance Snapshot */}
            {fullProperty?.documents && (
              <div className="admin-panel-muted rounded-xl p-3.5 border border-[#d6c7b2]/70">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#5d503f] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Property Compliance Snapshot
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAuditModalOpen(true)}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-transparent border-none cursor-pointer"
                  >
                    View Full Compliance Audit
                  </button>
                </div>
                <div className="flex items-center gap-5 text-xs text-[#5d503f]">
                  <span className="flex items-center gap-1.5 font-medium">
                    {getDocIcon(fullProperty.documents.deed)} Title Deed: {fullProperty.documents.deed}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {getDocIcon(fullProperty.documents.tax)} Tax Dec: {fullProperty.documents.tax}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    {getDocIcon(fullProperty.documents.survey)} Survey Plan: {fullProperty.documents.survey}
                  </span>
                </div>
              </div>
            )}

            {/* Notes Section */}
            <div className="admin-panel-muted rounded-xl p-3.5 border border-[#d6c7b2]/70">
              <div className="flex items-center gap-1.5 text-[#5d503f] mb-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Administrative Notes & History
                </span>
              </div>
              <p className="text-xs text-[#3d3225] whitespace-pre-line leading-relaxed">
                {transaction.notes || 'No remarks or special terms recorded for this transaction.'}
              </p>
            </div>

            {transaction.correctionHistory && transaction.correctionHistory.length > 0 && (
              <div className="admin-panel-muted rounded-xl p-3.5 border border-amber-200 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Correction History</p>
                {transaction.correctionHistory.map((correction) => (
                  <div key={correction.id} className="border-t border-amber-200 pt-2 text-xs text-[#3d3225]">
                    <div className="flex justify-between gap-2"><strong>{formatPrice(correction.original.amount)} → {formatPrice(correction.revised.amount)}</strong><span>{formatDateTime(correction.correctedAt)}</span></div>
                    <p className="mt-1">Reason: {correction.reason}</p>
                    <p className="text-[10px] text-[#7c6a57]">By: {correction.correctedBy?.fullName || correction.correctedBy?.username || 'Administrator'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Footer with actions */}
            <div className="pt-2 flex items-center justify-between border-t border-[#ded2c0]">
              <div className="text-[11px] text-[#7c6a57]">
                {transaction.status === 'Completed' && (
                  <span className="text-emerald-800 font-semibold">
                    ✓ Finalized record — property marked Sold.
                  </span>
                )}
                {transaction.status === 'Cancelled' && (
                  <span className="text-stone-700 font-semibold">
                    Voided record preserved for history.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isEligibleForActions && onCancel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onCancel(transaction);
                    }}
                    className="admin-button-secondary px-3.5 py-2 text-rose-700 hover:text-rose-900 border-rose-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel / Void
                  </button>
                )}
                {isEligibleForActions && onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEdit(transaction);
                    }}
                    className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer border-none hover:brightness-105 flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Transaction
                  </button>
                )}
                {transaction.status === 'Completed' && onCorrect && (
                  <button type="button" onClick={() => { onClose(); onCorrect(transaction); }} className="admin-button px-4 py-2 rounded-xl text-xs font-bold text-white border-none flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5" /> Correct Transaction
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="admin-button-secondary px-4 py-2 rounded-xl text-xs font-bold text-[#5d503f] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
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
