import React, { useMemo, useRef } from 'react';
import { X, AlertTriangle, RefreshCw, Loader2, Users, DollarSign } from 'lucide-react';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import type { AdminBuyerProfile } from '../../services/AdminBuyerService';
import type { Transaction } from '../../services/TransactionService';

export type AnalyticsDrilldownKind =
  | 'budget'
  | 'preferred_type'
  | 'preferred_location'
  | 'monthly_revenue';

export interface AnalyticsDrilldownSelection {
  kind: AnalyticsDrilldownKind;
  label: string;
  key: string;
  chartCount?: number;
  chartRevenue?: number;
}

export interface AnalyticsDrilldownModalProps {
  selection: AnalyticsDrilldownSelection | null;
  onClose: () => void;
  buyers: AdminBuyerProfile[] | null;
  buyersLoading: boolean;
  buyersError: string;
  onRetryBuyers: () => void;
  transactions: Transaction[] | null;
  transactionsLoading: boolean;
  transactionsError: string;
  onRetryTransactions: () => void;
}

// Matches backend budgetBuckets in analyticsService.js (getBuyerIntelligence)
const BUDGET_BUCKETS: Record<string, { min: number; max: number }> = {
  'Under ₱1M': { min: 0, max: 1000000 },
  '₱1M - ₱2M': { min: 1000000, max: 2000000 },
  '₱2M - ₱4M': { min: 2000000, max: 4000000 },
  '₱4M - ₱6M': { min: 4000000, max: 6000000 },
  'Over ₱6M': { min: 6000000, max: Infinity },
};

function formatPeso(value: number): string {
  return `₱${Math.round(value).toLocaleString('en-US')}`;
}

function formatBudgetBound(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return 'Not specified';
  }
  return formatPeso(value);
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  const hasMin = typeof min === 'number' && Number.isFinite(min) && min > 0;
  const hasMax = typeof max === 'number' && Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) return `${formatPeso(min)} – ${formatPeso(max)}`;
  if (hasMin) return `From ${formatPeso(min)}`;
  if (hasMax) return `Up to ${formatPeso(max)}`;
  return 'Not specified';
}

function formatBuyerDisplay(buyer: AdminBuyerProfile): { primary: string; secondary: string | null } {
  const fullName = buyer.fullName?.trim();
  const username = buyer.username?.trim();
  if (fullName && username && fullName !== username) {
    return { primary: fullName, secondary: `@${username}` };
  }
  return { primary: fullName || username || 'Buyer', secondary: null };
}

function getTransactionEffectiveDate(txn: Transaction): { iso: string | null; isFallback: boolean } {
  if (txn.completedAt) return { iso: txn.completedAt, isFallback: false };
  return { iso: txn.updatedAt || txn.createdAt || null, isFallback: true };
}

function getTransactionMonthKey(txn: Transaction): string | null {
  const { iso } = getTransactionEffectiveDate(txn);
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const AnalyticsDrilldownModal: React.FC<AnalyticsDrilldownModalProps> = ({
  selection,
  onClose,
  buyers,
  buyersLoading,
  buyersError,
  onRetryBuyers,
  transactions,
  transactionsLoading,
  transactionsError,
  onRetryTransactions,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isOpen = selection !== null;

  const modalRef = useModalAccessibility({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  const isBuyerDrilldown =
    selection !== null &&
    (selection.kind === 'budget' ||
      selection.kind === 'preferred_type' ||
      selection.kind === 'preferred_location');

  const isRevenueDrilldown = selection?.kind === 'monthly_revenue';

  const matchingBuyers = useMemo(() => {
    if (!selection || !isBuyerDrilldown || !buyers) return [];
    const withPrefs = buyers.filter((b) => b.preferences !== null);

    if (selection.kind === 'budget') {
      const bucket = BUDGET_BUCKETS[selection.key];
      if (!bucket) return [];
      return withPrefs.filter((b) => {
        const pref = b.preferences!;
        // Matches backend analyticsService.js: (pref.budgetMin + pref.budgetMax) / 2
        const mid = ((pref.budgetMin ?? 0) + (pref.budgetMax ?? 0)) / 2;
        return mid >= bucket.min && mid < bucket.max;
      });
    }

    if (selection.kind === 'preferred_type') {
      return withPrefs.filter((b) => b.preferences?.landType === selection.key);
    }

    if (selection.kind === 'preferred_location') {
      return withPrefs.filter((b) => b.preferences?.location === selection.key);
    }

    return [];
  }, [buyers, isBuyerDrilldown, selection]);

  const matchingTransactions = useMemo(() => {
    if (!selection || !isRevenueDrilldown || !transactions) return [];
    return transactions
      .filter((txn) => txn.status === 'Completed' && getTransactionMonthKey(txn) === selection.key)
      .sort((a, b) => {
        const aTime = new Date(getTransactionEffectiveDate(a).iso ?? 0).getTime();
        const bTime = new Date(getTransactionEffectiveDate(b).iso ?? 0).getTime();
        return bTime - aTime;
      });
  }, [isRevenueDrilldown, selection, transactions]);

  const matchedRevenueSum = useMemo(
    () => matchingTransactions.reduce((sum, txn) => sum + (txn.amount || 0), 0),
    [matchingTransactions]
  );

  if (!selection) return null;

  const isLoading = isBuyerDrilldown ? buyersLoading : transactionsLoading;
  const errorMessage = isBuyerDrilldown ? buyersError : transactionsError;
  const onRetry = isBuyerDrilldown ? onRetryBuyers : onRetryTransactions;

  const modalTitle =
    selection.kind === 'budget'
      ? `Budget Distribution — ${selection.label}`
      : selection.kind === 'preferred_type'
        ? `Preferred Property Type — ${selection.label}`
        : selection.kind === 'preferred_location'
          ? `Preferred Location — ${selection.label}`
          : `Monthly Revenue — ${selection.label}`;

  const categoryLabel =
    selection.kind === 'budget'
      ? `Budget bucket: ${selection.label}`
      : selection.kind === 'preferred_type'
        ? `Property type: ${selection.label}`
        : selection.kind === 'preferred_location'
          ? `Location: ${selection.label}`
          : `Period: ${selection.label} (${selection.key})`;

  const recordCount = isBuyerDrilldown ? matchingBuyers.length : matchingTransactions.length;

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center p-4"
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-drilldown-title"
        tabIndex={-1}
        className="admin-panel relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden focus:outline-none"
        style={{ boxShadow: '0 12px 36px rgba(15, 23, 42, 0.22)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#d6c7b2]">
          <div className="flex items-start gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true">
              {isRevenueDrilldown ? <DollarSign className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            </span>
            <div className="min-w-0">
              <h2
                id="analytics-drilldown-title"
                className="text-[#2f2417] font-semibold text-base leading-snug"
              >
                {modalTitle}
              </h2>
              <p className="text-xs text-[#7c6a57] mt-0.5">{categoryLabel}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close drill-down details"
            className="p-1.5 rounded-lg text-[#7c6a57] hover:text-[#2f2417] hover:bg-white/60 bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary bar */}
        {!isLoading && !errorMessage && (
          <div className="px-6 py-3 bg-white/40 border-b border-[#e8e0d5] flex flex-wrap items-center justify-between gap-2 text-xs text-[#5d503f]">
            <span>
              <strong>{recordCount}</strong>{' '}
              {isRevenueDrilldown
                ? `completed ${recordCount === 1 ? 'transaction' : 'transactions'}`
                : `matching ${recordCount === 1 ? 'buyer' : 'buyers'}`}
              {isBuyerDrilldown &&
                selection.chartCount !== undefined &&
                selection.chartCount !== recordCount && (
                  <span className="text-[#7c6a57]"> (chart count: {selection.chartCount})</span>
                )}
            </span>
            {isRevenueDrilldown && selection.chartRevenue !== undefined && (
              <span>
                Monthly total:{' '}
                <strong className="text-[#2f2417]">{formatPeso(selection.chartRevenue)}</strong>
                {matchedRevenueSum !== selection.chartRevenue && matchingTransactions.length > 0 && (
                  <span className="text-[#7c6a57]">
                    {' '}
                    (listed sum: {formatPeso(matchedRevenueSum)})
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#7c6a57]">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-sm">Loading underlying records…</p>
            </div>
          ) : errorMessage ? (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/50 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-700"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : recordCount === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-[#7c6a57]">
                {isRevenueDrilldown
                  ? `No completed transactions found for ${selection.label}.`
                  : `No buyers match ${selection.label}.`}
              </p>
            </div>
          ) : isBuyerDrilldown ? (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-sm">
                <thead>
                  <tr className="text-left text-[#7c6a57] text-xs uppercase tracking-wider border-b border-[#d6c7b2]">
                    <th className="py-2.5 pr-4 font-semibold">Buyer</th>
                    {selection.kind === 'budget' ? (
                      <>
                        <th className="py-2.5 pr-4 font-semibold">Budget Min</th>
                        <th className="py-2.5 pr-4 font-semibold">Budget Max</th>
                        <th className="py-2.5 pr-4 font-semibold">Preferred Type</th>
                        <th className="py-2.5 font-semibold">Preferred Location</th>
                      </>
                    ) : selection.kind === 'preferred_type' ? (
                      <>
                        <th className="py-2.5 pr-4 font-semibold">Budget Range</th>
                        <th className="py-2.5 pr-4 font-semibold">Preferred Location</th>
                        <th className="py-2.5 font-semibold">Intended Use</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 pr-4 font-semibold">Preferred Type</th>
                        <th className="py-2.5 pr-4 font-semibold">Budget Range</th>
                        <th className="py-2.5 font-semibold">Intended Use</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matchingBuyers.map((buyer, idx) => {
                    const display = formatBuyerDisplay(buyer);
                    const pref = buyer.preferences;
                    return (
                      <tr
                        key={buyer.userId}
                        className={`border-b border-[#e8e0d5] last:border-none ${
                          idx % 2 === 0 ? 'bg-white/25' : ''
                        }`}
                      >
                        <td className="py-2.5 pr-4">
                          <p className="text-[#2f2417] font-medium">{display.primary}</p>
                          {display.secondary && (
                            <p className="text-[11px] text-[#7c6a57]">{display.secondary}</p>
                          )}
                        </td>
                        {selection.kind === 'budget' ? (
                          <>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {formatBudgetBound(pref?.budgetMin)}
                            </td>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {formatBudgetBound(pref?.budgetMax)}
                            </td>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {pref?.landType || 'Not specified'}
                            </td>
                            <td className="py-2.5 text-[#5d503f]">
                              {pref?.location || 'Not specified'}
                            </td>
                          </>
                        ) : selection.kind === 'preferred_type' ? (
                          <>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {formatBudgetRange(pref?.budgetMin, pref?.budgetMax)}
                            </td>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {pref?.location || 'Not specified'}
                            </td>
                            <td className="py-2.5 text-[#5d503f]">
                              {pref?.intendedUse || 'Not specified'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {pref?.landType || 'Not specified'}
                            </td>
                            <td className="py-2.5 pr-4 text-[#5d503f]">
                              {formatBudgetRange(pref?.budgetMin, pref?.budgetMax)}
                            </td>
                            <td className="py-2.5 text-[#5d503f]">
                              {pref?.intendedUse || 'Not specified'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table w-full text-sm">
                <thead>
                  <tr className="text-left text-[#7c6a57] text-xs uppercase tracking-wider border-b border-[#d6c7b2]">
                    <th className="py-2.5 pr-4 font-semibold">Reference</th>
                    <th className="py-2.5 pr-4 font-semibold">Property</th>
                    <th className="py-2.5 pr-4 font-semibold">Buyer</th>
                    <th className="py-2.5 pr-4 font-semibold">Amount</th>
                    <th className="py-2.5 font-semibold">Completion Date</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingTransactions.map((txn, idx) => {
                    const effective = getTransactionEffectiveDate(txn);
                    const propertyLabel =
                      txn.propertyId?.name || txn.propertyId?.title || 'Unavailable property';
                    const buyerLabel =
                      txn.buyerId?.fullName || txn.buyerId?.username || 'Unavailable buyer';
                    return (
                      <tr
                        key={txn.id || txn._id || `${txn.reference}-${idx}`}
                        className={`border-b border-[#e8e0d5] last:border-none ${
                          idx % 2 === 0 ? 'bg-white/25' : ''
                        }`}
                      >
                        <td className="py-2.5 pr-4 font-medium text-[#2f2417]">
                          {txn.reference || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-[#5d503f]">{propertyLabel}</td>
                        <td className="py-2.5 pr-4 text-[#5d503f]">{buyerLabel}</td>
                        <td className="py-2.5 pr-4 font-medium text-[#2f2417]">
                          {formatPeso(txn.amount || 0)}
                        </td>
                        <td className="py-2.5 text-[#5d503f]">
                          {formatDateDisplay(effective.iso)}
                          {effective.isFallback && effective.iso && (
                            <span className="block text-[10px] text-[#7c6a57]">
                              Recorded update date
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#d6c7b2] flex items-center justify-end bg-white/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#2f2417] bg-white border border-[#d6c7b2] hover:bg-[#f7f4ed] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
