import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CreditCard,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { AdminBuyerDetails, AdminBuyerProfile } from '../../services/AdminBuyerService';
import { getBuyerDetails } from '../../services/AdminBuyerService';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import { UserAvatar } from '../Shared/UserAvatar';

interface ViewBuyerModalProps {
  isOpen: boolean;
  buyer: AdminBuyerProfile | null;
  onClose: () => void;
}

const readable = (value: string | number | null | undefined, fallback = 'Not provided') => {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  return String(value).trim();
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not provided';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not provided';
  return parsed.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not provided';
  return `₱${Math.round(value).toLocaleString()}`;
};

const formatBudgetRange = (min?: number | null, max?: number | null) => {
  const hasMin = typeof min === 'number' && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === 'number' && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `₱${Math.round(min).toLocaleString()} – ₱${Math.round(max).toLocaleString()}`;
  if (hasMin) return `From ₱${Math.round(min).toLocaleString()}`;
  if (hasMax) return `Up to ₱${Math.round(max).toLocaleString()}`;
  return 'Not specified';
};

const formatLotSize = (minLotSize?: number | null) => {
  if (typeof minLotSize !== 'number' || !Number.isFinite(minLotSize) || minLotSize <= 0) {
    return 'Not specified';
  }
  return `${Math.round(minLotSize).toLocaleString()} sqm`;
};

const statusBadgeClass = (status: string) => {
  const normalized = (status || '').toLowerCase();
  if (['completed', 'confirmed', 'responded', 'approved', 'converted'].includes(normalized)) {
    return 'status-success';
  }
  if (['pending', 'scheduled', 'in_progress', 'open'].includes(normalized)) {
    return 'status-warning';
  }
  return 'status-neutral';
};

export const ViewBuyerModal: React.FC<ViewBuyerModalProps> = ({
  isOpen,
  buyer,
  onClose,
}) => {
  const modalRef = useModalAccessibility({ isOpen, onClose });
  const [details, setDetails] = useState<AdminBuyerDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!isOpen || !buyer?.userId) {
      setDetails(null);
      setLoadError('');
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setLoadError('');

    getBuyerDetails(buyer.userId)
      .then((data) => {
        if (isCancelled) return;
        setDetails(data);
      })
      .catch((error) => {
        if (isCancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load buyer details right now.'
        );
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, buyer?.userId, retryToken]);

  if (!isOpen || !buyer) return null;

  const activeBuyer = details ?? buyer;
  const displayName = readable(activeBuyer.fullName, activeBuyer.username || 'Buyer');
  const prefs = activeBuyer.preferences;

  return (
    <div
      className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="view-buyer-title"
        tabIndex={-1}
        className="admin-panel relative z-[10000] flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white"
        style={{ background: '#ffffff', boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)' }}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8dfd3] bg-white px-5 py-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              src={activeBuyer.profilePictureUrl}
              name={displayName}
              size="lg"
            />
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider text-[#7c6a57]">Buyer details</p>
              <h2
                id="view-buyer-title"
                className="mt-0.5 break-words font-serif text-base font-bold text-[#2f2417]"
              >
                {displayName}
              </h2>
              <p className="mt-0.5 text-[11px] text-[#7c6a57] break-words">
                @{activeBuyer.username} · Registered {formatDate(activeBuyer.registeredAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="admin-icon-btn shrink-0 rounded-lg"
            aria-label="Close buyer details"
            title="Close buyer details"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 overflow-y-auto px-5 py-4 space-y-5">
          {/* Buyer Personal Information */}
          <section aria-labelledby="buyer-modal-identity-heading">
            <h3
              id="buyer-modal-identity-heading"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"
            >
              <UserIcon className="h-3.5 w-3.5 text-neutral" aria-hidden="true" />
              Personal information
            </h3>
            <dl className="mt-1 divide-y divide-[#eee7dd] text-[11px]">
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Full Name</dt>
                <dd className="text-right font-semibold text-[#223127] break-words">
                  {readable(activeBuyer.fullName)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Username</dt>
                <dd className="text-right font-semibold text-[#223127]">
                  @{activeBuyer.username}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Email Address</dt>
                <dd className="text-right font-semibold text-[#223127] break-all">
                  {readable(activeBuyer.email)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Contact Number</dt>
                <dd className="text-right font-semibold text-[#223127]">
                  {readable(activeBuyer.contactNumber)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Address</dt>
                <dd className="max-w-[70%] text-right font-semibold text-[#223127] break-words">
                  {readable(activeBuyer.address)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2">
                <dt className="text-[#7c6a57]">Registration Date</dt>
                <dd className="text-right font-semibold text-[#223127]">
                  {formatDate(activeBuyer.registeredAt)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Saved Preferences */}
          <section aria-labelledby="buyer-modal-preferences-heading">
            <h3
              id="buyer-modal-preferences-heading"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-neutral" aria-hidden="true" />
              Saved preferences
            </h3>
            {!prefs ? (
              <p className="mt-2 rounded-xl border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 px-4 py-3 text-[11px] text-[#7c6a57]">
                No saved property preferences yet.
              </p>
            ) : (
              <dl className="mt-1 divide-y divide-[#eee7dd] text-[11px]">
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-[#7c6a57]">Budget</dt>
                  <dd className="text-right font-semibold text-[#223127]">
                    {formatBudgetRange(prefs.budgetMin, prefs.budgetMax)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-[#7c6a57]">Property Type</dt>
                  <dd className="text-right font-semibold text-[#223127]">
                    {readable(prefs.landType, 'Not specified')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-[#7c6a57]">Intended Use</dt>
                  <dd className="text-right font-semibold text-[#223127]">
                    {readable(prefs.intendedUse, 'Not specified')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-[#7c6a57]">Location</dt>
                  <dd className="max-w-[70%] text-right font-semibold text-[#223127] break-words">
                    {readable(prefs.location, 'Not specified')}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-2">
                  <dt className="text-[#7c6a57]">Minimum Lot Size</dt>
                  <dd className="text-right font-semibold text-[#223127]">
                    {formatLotSize(prefs.minLotSize)}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          {/* Activity History Loading / Error / Sections */}
          {isLoading ? (
            <div
              role="status"
              className="rounded-xl border border-[#e8dfd3] bg-[#faf6ef]/60 px-4 py-6 text-center text-xs text-[#7c6a57]"
            >
              Loading buyer inquiry, site visit, and transaction history...
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center"
            >
              <p className="text-xs font-semibold text-red-800">{loadError}</p>
              <button
                type="button"
                onClick={() => setRetryToken((current) => current + 1)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : details ? (
            <>
              {/* Inquiry History */}
              <section aria-labelledby="buyer-modal-inquiries-heading">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="buyer-modal-inquiries-heading"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"
                  >
                    <Mail className="h-3.5 w-3.5 text-neutral" aria-hidden="true" />
                    Inquiry history
                  </h3>
                  <span className="text-[10px] text-[#7c6a57]">
                    {details.inquiries.length} record{details.inquiries.length === 1 ? '' : 's'}
                  </span>
                </div>
                {details.inquiries.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 px-4 py-3 text-[11px] text-[#7c6a57]">
                    No inquiries submitted by this buyer.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#eee7dd] rounded-xl border border-[#e8dfd3]">
                    {details.inquiries.map((inquiry) => (
                      <div key={inquiry.id} className="px-3.5 py-2.5 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#223127]">
                            {inquiry.property?.name || 'Property unavailable'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(inquiry.status)}`}
                          >
                            {inquiry.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#7c6a57]">
                          {formatDate(inquiry.createdAt)}
                        </p>
                        {inquiry.message && (
                          <p className="mt-1 text-[#4d5e4d] break-words whitespace-pre-wrap">
                            {inquiry.message}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Site Visit History */}
              <section aria-labelledby="buyer-modal-visits-heading">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="buyer-modal-visits-heading"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"
                  >
                    <Calendar className="h-3.5 w-3.5 text-neutral" aria-hidden="true" />
                    Site visit history
                  </h3>
                  <span className="text-[10px] text-[#7c6a57]">
                    {details.siteVisits.length} record{details.siteVisits.length === 1 ? '' : 's'}
                  </span>
                </div>
                {details.siteVisits.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 px-4 py-3 text-[11px] text-[#7c6a57]">
                    No site visits scheduled by this buyer.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#eee7dd] rounded-xl border border-[#e8dfd3]">
                    {details.siteVisits.map((visit) => (
                      <div key={visit.id} className="px-3.5 py-2.5 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#223127]">
                            {visit.property?.name || 'Property unavailable'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(visit.status)}`}
                          >
                            {visit.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#7c6a57]">
                          Date: {readable(visit.preferredDate)} · Time: {readable(visit.preferredTime, 'Not specified')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Transaction History */}
              <section aria-labelledby="buyer-modal-transactions-heading">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    id="buyer-modal-transactions-heading"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-[#2f2417]"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-neutral" aria-hidden="true" />
                    Transaction history
                  </h3>
                  <span className="text-[10px] text-[#7c6a57]">
                    {details.transactions.length} record{details.transactions.length === 1 ? '' : 's'}
                  </span>
                </div>
                {details.transactions.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-[#cdbda6] bg-[#faf6ef]/60 px-4 py-3 text-[11px] text-[#7c6a57]">
                    No transactions recorded for this buyer.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-[#eee7dd] rounded-xl border border-[#e8dfd3]">
                    {details.transactions.map((tx) => (
                      <div key={tx.id} className="px-3.5 py-2.5 text-[11px]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#223127]">
                            {tx.property?.name || 'Property unavailable'}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(tx.status)}`}
                          >
                            {tx.status}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#7c6a57]">
                          <span>
                            Ref: <span className="font-mono font-semibold text-[#3d4a3d]">{readable(tx.reference)}</span> · {formatDate(tx.completedAt || tx.createdAt)}
                          </span>
                          <span className="font-mono font-bold text-[#223127]">
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[#e8dfd3] bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="admin-button-secondary rounded-xl px-4 py-2 text-xs font-semibold text-[#3d4a3d] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewBuyerModal;
