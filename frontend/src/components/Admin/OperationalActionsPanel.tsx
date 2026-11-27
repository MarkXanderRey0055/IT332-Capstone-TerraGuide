import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { OperationalActionsResponse } from '../../services/AnalyticsService';
import { updateSiteVisitStatus } from '../../services/SiteVisitService';
import type { AdminAnalyticsNavigateTarget } from '../../pages/Admin/AdminAnalytics';

export interface OperationalActionsPanelProps {
  data: OperationalActionsResponse | null;
  loading: boolean;
  error: string;
  title?: string;
  subtitle?: string;
  onNavigate?: (target: AdminAnalyticsNavigateTarget) => void;
  onMissedSubmitted?: () => Promise<void> | void;
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function extractYmdParts(value?: string | number | null): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return [year, month, day];
}

function formatShortCalendarDate(value?: string | number | null): string | null {
  const parts = extractYmdParts(value);
  if (!parts) return null;
  const [, month, day] = parts;
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

function getManilaCalendarDate(computedAt?: string): string | null {
  if (!computedAt) return null;
  const date = new Date(computedAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function computeCalendarDaysBetween(
  earlierDate?: string | number | null,
  laterDate?: string | null
): number | null {
  const start = extractYmdParts(earlierDate);
  const end = extractYmdParts(laterDate);
  if (!start || !end) return null;
  const startMs = Date.UTC(start[0], start[1] - 1, start[2]);
  const endMs = Date.UTC(end[0], end[1] - 1, end[2]);
  return Math.max(0, Math.round((endMs - startMs) / MS_PER_DAY));
}

function formatLastCheckedManila(computedAt?: string): string | null {
  if (!computedAt) return null;
  const date = new Date(computedAt);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = getPart('hour');
  const minute = getPart('minute');
  const dayPeriod = getPart('dayPeriod').toUpperCase();
  if (!hour || !minute || !dayPeriod) return null;
  return `${hour}:${minute} ${dayPeriod}`;
}

export const OperationalActionsPanel: React.FC<OperationalActionsPanelProps> = ({
  data,
  loading,
  error,
  title = 'Follow-ups due',
  subtitle = 'Records that need follow-up now.',
  onNavigate,
  onMissedSubmitted,
}) => {
  const [missedFormVisitId, setMissedFormVisitId] = useState<string | null>(null);
  const [missedReasonDraft, setMissedReasonDraft] = useState('');
  const [missedSubmitError, setMissedSubmitError] = useState('');
  const [isSubmittingMissed, setIsSubmittingMissed] = useState(false);

  const handleSubmitMissedVisit = async (visitId: string) => {
    const trimmedReason = missedReasonDraft.trim();
    if (!trimmedReason || isSubmittingMissed) return;
    setIsSubmittingMissed(true);
    setMissedSubmitError('');
    try {
      await updateSiteVisitStatus(visitId, 'Missed', '', {}, trimmedReason);
      setMissedFormVisitId(null);
      setMissedReasonDraft('');
      setMissedSubmitError('');
      await onMissedSubmitted?.();
    } catch {
      setMissedSubmitError('Could not mark this visit as missed. Try again.');
    } finally {
      setIsSubmittingMissed(false);
    }
  };

  const rawActions = data?.operationalActions.actions ?? [];
  // Properties Requiring Attention on the dashboard already covers high-risk listings.
  const visibleActions = rawActions.filter(
    (actionItem) => actionItem.ruleId !== 'HIGH_RISK_DOCUMENTS'
  );
  const computedAt = data?.operationalActions.computedAt;
  const manilaRefDate = getManilaCalendarDate(computedAt) ?? data?.operationalActions.referenceDate ?? null;
  const lastCheckedTime = formatLastCheckedManila(computedAt);

  return (
    <section className="admin-panel rounded-2xl p-6 space-y-4" aria-labelledby="follow-ups-due-heading">
      <div className="flex items-center gap-2 border-b border-[#d6c7b2] pb-4">
        <span className="p-1.5 rounded-lg bg-amber-50" aria-hidden="true">
          <AlertTriangle className="w-4 h-4 text-amber-700" />
        </span>
        <div>
          <h2 id="follow-ups-due-heading" className="text-[#2f2417] font-semibold text-base">
            {title}
          </h2>
          <p className="text-[#7c6a57] text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-[#7c6a57]">Loading follow-ups…</p>}

      {!loading && error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-rose-50/50 border border-rose-200/30 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>We could not load the follow-up list. Refresh the page or try again later.</span>
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="space-y-5">
            {visibleActions.length === 0 ? (
              <p className="text-sm text-[#7c6a57]">
                Nothing needs follow-up right now. Good work.
              </p>
            ) : (
              visibleActions.map((actionItem) => {
                const isInquiryRule = actionItem.ruleId === 'STALE_PENDING_INQUIRIES';
                const isVisitRule = actionItem.ruleId === 'OVERDUE_PENDING_SITE_VISITS';
                const sectionHeading = isInquiryRule
                  ? 'Buyers waiting for a reply'
                  : isVisitRule
                    ? 'Visits that did not happen on schedule'
                    : 'Items needing follow-up';
                const sectionHint = isInquiryRule
                  ? 'Inquiries unanswered for more than a week.'
                  : isVisitRule
                    ? 'The preferred date has passed, but the visit is still pending.'
                    : '';
                const countLine = isInquiryRule
                  ? `${actionItem.matchCount} ${actionItem.matchCount === 1 ? 'buyer' : 'buyers'} waiting for a reply.`
                  : isVisitRule
                    ? `${actionItem.matchCount} ${actionItem.matchCount === 1 ? 'visit' : 'visits'} need a decision.`
                    : '';

                return (
                  <div
                    key={actionItem.ruleId}
                    className="pb-4 border-b border-[#e8e0d5] last:border-none last:pb-0 space-y-3"
                  >
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-semibold text-[#2f2417]">{sectionHeading}</h3>
                      {sectionHint && <p className="text-xs text-[#7c6a57]">{sectionHint}</p>}
                      {countLine && (
                        <p className="text-xs font-medium text-[#5d503f] pt-0.5">{countLine}</p>
                      )}
                    </div>

                    {actionItem.evidence.length > 0 && (
                      <ul className="space-y-2.5">
                        {actionItem.evidence.map((record, idx) => {
                          const inquiryId =
                            typeof record.inquiryId === 'string' ? record.inquiryId : '';
                          const siteVisitId =
                            typeof record.siteVisitId === 'string' ? record.siteVisitId : '';
                          const propertyId =
                            typeof record.propertyId === 'string' ? record.propertyId : '';
                          const propertyName =
                            typeof record.propertyName === 'string' && record.propertyName.trim()
                              ? record.propertyName
                              : 'Listing';

                          const inquiryDate = isInquiryRule
                            ? formatShortCalendarDate(record.createdAtManila)
                            : null;
                          const inquiryDays =
                            isInquiryRule &&
                            typeof record.ageHours === 'number' &&
                            Number.isFinite(record.ageHours)
                              ? Math.floor(record.ageHours / 24)
                              : null;

                          const visitDate = isVisitRule
                            ? formatShortCalendarDate(record.preferredDate)
                            : null;
                          const visitDaysPassed = isVisitRule
                            ? computeCalendarDaysBetween(record.preferredDate, manilaRefDate)
                            : null;

                          const isMissedFormOpen =
                            isVisitRule &&
                            siteVisitId !== '' &&
                            missedFormVisitId === siteVisitId;

                          return (
                            <li
                              key={`${actionItem.ruleId}-${idx}`}
                              className="rounded-xl bg-white/50 p-3 space-y-2"
                            >
                              <div
                                className={`flex flex-col sm:flex-row justify-between gap-3 ${
                                  isVisitRule ? 'sm:items-center' : 'sm:items-start'
                                }`}
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <p className="text-sm font-medium text-[#2f2417]">
                                    {propertyName}
                                  </p>
                                  {isInquiryRule && (
                                    <p className="text-xs text-[#5d503f]">
                                      {[
                                        inquiryDate ? `Sent ${inquiryDate}` : null,
                                        inquiryDays !== null
                                          ? `${inquiryDays} ${inquiryDays === 1 ? 'day' : 'days'} ago`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                  {isVisitRule && (
                                    <p className="text-xs text-[#5d503f]">
                                      {[
                                        visitDate ? `Preferred date ${visitDate}` : null,
                                        visitDaysPassed !== null
                                          ? `Passed ${visitDaysPassed} ${visitDaysPassed === 1 ? 'day' : 'days'} ago`
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </p>
                                  )}
                                </div>

                                {isVisitRule && siteVisitId ? (
                                  <div className="flex flex-col items-end shrink-0">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onNavigate?.({
                                            page: 'activities',
                                            tab: 'sitevisits',
                                            recordId: siteVisitId,
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                      >
                                        Schedule
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setMissedFormVisitId(siteVisitId);
                                          setMissedReasonDraft('');
                                          setMissedSubmitError('');
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 cursor-pointer"
                                      >
                                        Mark as missed
                                      </button>
                                    </div>
                                    <span className="text-[10px] text-[#7c6a57] mt-1 text-right">
                                      Use this only if the visit will not happen.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-start justify-end gap-2 sm:shrink-0">
                                    {isInquiryRule && inquiryId && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onNavigate?.({
                                            page: 'activities',
                                            tab: 'inquiries',
                                            recordId: inquiryId,
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                      >
                                        Reply
                                      </button>
                                    )}

                                    {!isInquiryRule && !isVisitRule && propertyId && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onNavigate?.({
                                            page: 'properties',
                                            propertyId,
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer"
                                      >
                                        Review documents
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {isMissedFormOpen && (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void handleSubmitMissedVisit(siteVisitId);
                                  }}
                                  className="mt-1.5 p-3 rounded-xl bg-white/80 border border-[#d6c7b2] space-y-2 max-w-lg"
                                >
                                  <label
                                    htmlFor={`missed-reason-${siteVisitId}`}
                                    className="block text-[11px] font-medium text-[#2f2417]"
                                  >
                                    Internal reason (not shown to the buyer)
                                  </label>
                                  <textarea
                                    id={`missed-reason-${siteVisitId}`}
                                    rows={2}
                                    value={missedReasonDraft}
                                    onChange={(e) => setMissedReasonDraft(e.target.value)}
                                    className="w-full rounded-lg border border-[#d6c7b2] bg-white px-2.5 py-1.5 text-xs text-[#2f2417] focus:outline-none focus:border-emerald-600"
                                  />
                                  {missedSubmitError && (
                                    <p className="text-[11px] text-rose-700">{missedSubmitError}</p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="submit"
                                      disabled={!missedReasonDraft.trim() || isSubmittingMissed}
                                      className="px-3 py-1 rounded-lg text-[11px] font-semibold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer"
                                    >
                                      {isSubmittingMissed ? 'Saving…' : 'Confirm missed'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMissedFormVisitId(null);
                                        setMissedReasonDraft('');
                                        setMissedSubmitError('');
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#5d503f] bg-transparent border border-[#d6c7b2] hover:bg-white cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <p className="text-xs text-[#7c6a57]">
            {lastCheckedTime
              ? `Last checked ${lastCheckedTime}.`
              : 'Last checked time unavailable.'}
          </p>
        </>
      )}
    </section>
  );
};
