import React, { useEffect, useState } from 'react';
import { formatActivityTimestamp } from '../../utils/activityTimestamp';
import { Mail, Calendar, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { getAllInquiries, getInquiryBuyerId, getInquiryPropertyId, updateInquiryStatus } from '../../services/InquiryService';
import type { Inquiry } from '../../services/InquiryService';
import { getAllSiteVisits, updateSiteVisitStatus } from '../../services/SiteVisitService';
import type { SiteVisit } from '../../services/SiteVisitService';
import { getTransactions } from '../../services/TransactionService';
import type { Transaction } from '../../services/TransactionService';
import { getProperties } from '../../services/PropertyService';
import type { Property } from '../../types/types';
import { TransactionFormModal } from '../../components/Admin/TransactionFormModal';
import type { InquiryConversionContext } from '../../components/Admin/TransactionFormModal';

interface AdminActivitiesProps {
  onToast?: (message: string) => void;
  initialTab?: 'inquiries' | 'sitevisits';
  targetRecordId?: string | null;
  onOpenTransaction?: (transactionId: string) => void;
}

const INQUIRY_STATUSES = ['Pending', 'Responded', 'Not interested', 'Property unavailable', 'Duplicate'] as const;
const INQUIRY_CLOSING_STATUSES = ['Not interested', 'Property unavailable', 'Duplicate'] as const;
const VISIT_STATUSES = ['Pending', 'Scheduled', 'Completed'] as const;
type ActivityTab = 'inquiries' | 'sitevisits';
type InquiryStatusFilter = 'All' | 'Closed' | 'Converted' | (typeof INQUIRY_STATUSES)[number];
type VisitStatusFilter = 'All' | (typeof VISIT_STATUSES)[number];

const inquiryNeedsReview = (inquiry: Inquiry) => {
  const hasResponse = (inquiry.adminResponse ?? '').trim().length > 0;
  return (inquiry.status === 'Pending' && hasResponse)
    || (inquiry.status === 'Responded' && !hasResponse);
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Responded: 'bg-emerald-100 text-emerald-800',
    Scheduled: 'bg-blue-100 text-blue-800',
    Completed: 'bg-emerald-100 text-emerald-800',
    'Not interested': 'bg-neutral-100 text-neutral-700',
    'Property unavailable': 'bg-neutral-100 text-neutral-700',
    Duplicate: 'bg-neutral-100 text-neutral-700',
    Converted: 'bg-teal-100 text-teal-900',
  };
  return (
    <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {status}
    </span>
  );
};

export const AdminActivities: React.FC<AdminActivitiesProps> = ({ onToast, initialTab = 'inquiries', targetRecordId = null, onOpenTransaction }) => {
  const [activeTab, setActiveTab] = useState<'inquiries' | 'sitevisits'>(initialTab);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [isInquiryLoading, setIsInquiryLoading] = useState(true);
  const [isSiteVisitLoading, setIsSiteVisitLoading] = useState(true);
  const [inquiryError, setInquiryError] = useState('');
  const [siteVisitError, setSiteVisitError] = useState('');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [closeReasonDrafts, setCloseReasonDrafts] = useState<Record<string, string>>({});
  const [inquiryStatusDrafts, setInquiryStatusDrafts] = useState<Record<string, Inquiry['status']>>({});
  const [visitStatusDrafts, setVisitStatusDrafts] = useState<Record<string, SiteVisit['status']>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, { date: string; time: string }>>({});
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState<InquiryStatusFilter>('All');
  const [visitStatusFilter, setVisitStatusFilter] = useState<VisitStatusFilter>('All');
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionProperties, setTransactionProperties] = useState<Property[]>([]);
  const [conversionContext, setConversionContext] = useState<InquiryConversionContext | null>(null);
  const [isLoadingConversionProperties, setIsLoadingConversionProperties] = useState(false);

  const isInquiryDirty = (item: Inquiry) =>
    (responseDrafts[item.id] ?? item.adminResponse ?? '') !== (item.adminResponse ?? '')
    || (inquiryStatusDrafts[item.id] ?? item.status) !== item.status
    || (closeReasonDrafts[item.id] ?? item.closeReason ?? '') !== (item.closeReason ?? '');
  const isVisitDirty = (item: SiteVisit) => {
    const schedule = scheduleDrafts[item.id] ?? { date: '', time: '' };
    const savedDate = item.confirmedDate ? new Date(item.confirmedDate).toISOString().slice(0, 10) : '';
    return (responseDrafts[item.id] ?? item.adminResponse ?? '') !== (item.adminResponse ?? '')
      || (visitStatusDrafts[item.id] ?? item.status) !== item.status
      || schedule.date !== savedDate
      || schedule.time !== (item.confirmedTime ?? '');
  };
  const hasUnsavedChanges = inquiries.some(isInquiryDirty) || siteVisits.some(isVisitDirty);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  const discardDrafts = () => {
    setResponseDrafts(Object.fromEntries([
      ...inquiries.map((item) => [item.id, item.adminResponse ?? ''] as const),
      ...siteVisits.map((item) => [item.id, item.adminResponse ?? ''] as const),
    ]));
    setCloseReasonDrafts(Object.fromEntries(inquiries.map((item) => [item.id, item.closeReason ?? ''])));
    setInquiryStatusDrafts(Object.fromEntries(inquiries.map((item) => [item.id, item.status])));
    setVisitStatusDrafts(Object.fromEntries(siteVisits.map((item) => [item.id, item.status])));
    setScheduleDrafts(Object.fromEntries(siteVisits.map((item) => [item.id, {
      date: item.confirmedDate ? new Date(item.confirmedDate).toISOString().slice(0, 10) : '',
      time: item.confirmedTime ?? '',
    }])));
  };

  const confirmDiscardDrafts = () => {
    if (!hasUnsavedChanges) return true;
    const discard = window.confirm('You have unsaved changes. Continue and discard them?');
    if (discard) discardDrafts();
    return discard;
  };

  const requestTabChange = (tab: ActivityTab) => {
    if (tab === activeTab || !confirmDiscardDrafts()) return;
    setActiveTab(tab);
  };

  useEffect(() => {
    if (!targetRecordId) return;
    const isLoadingTarget = initialTab === 'inquiries' ? isInquiryLoading : isSiteVisitLoading;
    if (isLoadingTarget) return;
    const targetExists = initialTab === 'inquiries'
      ? inquiries.some((item) => item.id === targetRecordId)
      : siteVisits.some((item) => item.id === targetRecordId);
    if (!targetExists) return;

    setHighlightedRecordId(targetRecordId);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`activity-record-${targetRecordId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    const highlightTimer = window.setTimeout(() => setHighlightedRecordId(null), 3000);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(highlightTimer);
    };
  }, [targetRecordId, initialTab, isInquiryLoading, isSiteVisitLoading, inquiries, siteVisits]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = ['inquiries', 'sitevisits'] as const;
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab === activeTab || confirmDiscardDrafts()) {
      if (nextTab !== activeTab) setActiveTab(nextTab);
      document.getElementById(`activities-tab-${nextTab}`)?.focus();
    }
  };

  const loadInquiries = async () => {
    setIsInquiryLoading(true);
    setInquiryError('');
    try {
      const inq = await getAllInquiries();
      setInquiries(inq);
      setResponseDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(inq.map((item) => [item.id, item.adminResponse ?? ''])),
      }));
      setInquiryStatusDrafts(Object.fromEntries(inq.map((item) => [item.id, item.status])));
      setCloseReasonDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(inq.map((item) => [item.id, item.closeReason ?? ''])),
      }));
    } catch {
      setInquiryError('Could not load inquiries. Please try again.');
    } finally {
      setIsInquiryLoading(false);
    }
  };

  const loadSiteVisits = async () => {
    setIsSiteVisitLoading(true);
    setSiteVisitError('');
    try {
      const vis = await getAllSiteVisits();
      setSiteVisits(vis);
      setResponseDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(vis.map((item) => [item.id, item.adminResponse ?? ''])),
      }));
      setVisitStatusDrafts(Object.fromEntries(vis.map((item) => [item.id, item.status])));
      setScheduleDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(vis.map((item) => [item.id, {
          date: item.confirmedDate ? new Date(item.confirmedDate).toISOString().slice(0, 10) : '',
          time: item.confirmedTime ?? '',
        }])),
      }));
    } catch {
      setSiteVisitError('Could not load site visits. Please try again.');
    } finally {
      setIsSiteVisitLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setTransactions(await getTransactions());
    } catch {
      // Inquiry and site-visit workspaces remain usable if transaction history fails.
    }
  };

  const openConversionForm = async (inquiry: Inquiry) => {
    setConversionContext({
      inquiryId: inquiry.id || '',
      buyerId: getInquiryBuyerId(inquiry),
      propertyId: getInquiryPropertyId(inquiry),
      buyerName: inquiry.buyerId?.fullName || inquiry.buyerId?.username || '',
      buyerEmail: inquiry.buyerId?.email || '',
      propertyName: inquiry.propertyId?.name || '',
      submittedAt: inquiry.createdAt || '',
    });
    setIsLoadingConversionProperties(true);
    try {
      const properties = await getProperties();
      setTransactionProperties(properties);
    } catch {
      setTransactionProperties([]);
      onToast?.('Could not load properties for the transaction. Please try again.');
    } finally {
      setIsLoadingConversionProperties(false);
    }
  };

  const handleConvertedTransactionCreated = () => {
    setConversionContext(null);
    void Promise.all([loadInquiries(), loadTransactions()]);
    onToast?.('Inquiry converted and transaction created.');
  };

  const load = async () => {
    if (isInquiryLoading || isSiteVisitLoading || !confirmDiscardDrafts()) return;
    await Promise.all([loadInquiries(), loadSiteVisits(), loadTransactions()]);
  };

  const retryInquiries = async () => {
    if (!confirmDiscardDrafts()) return;
    await loadInquiries();
  };

  const retrySiteVisits = async () => {
    if (!confirmDiscardDrafts()) return;
    await loadSiteVisits();
  };

  useEffect(() => {
    void Promise.all([loadInquiries(), loadSiteVisits()]);
    void loadTransactions();
  }, []);

  const handleInquirySave = async (inquiry: Inquiry) => {
    const nextStatus = inquiryStatusDrafts[inquiry.id] ?? inquiry.status;
    const isClosing = INQUIRY_CLOSING_STATUSES.includes(nextStatus as (typeof INQUIRY_CLOSING_STATUSES)[number]);
    if (isClosing && !window.confirm('Close this inquiry? Buyers will be notified, and it can’t be reopened from this page.')) return;
    setSavingActivityId(inquiry.id);
    try {
      const updated = await updateInquiryStatus(
        inquiry.id,
        nextStatus,
        responseDrafts[inquiry.id] ?? inquiry.adminResponse ?? '',
        closeReasonDrafts[inquiry.id] ?? inquiry.closeReason ?? ''
      );
      setInquiries((prev) => prev.map((item) => item.id === inquiry.id ? updated : item));
      setResponseDrafts((prev) => ({ ...prev, [inquiry.id]: updated.adminResponse ?? '' }));
      setInquiryStatusDrafts((prev) => ({ ...prev, [inquiry.id]: updated.status }));
      setCloseReasonDrafts((prev) => ({ ...prev, [inquiry.id]: updated.closeReason ?? '' }));
      onToast?.('Inquiry updated.');
    } catch (error) {
      onToast?.(error instanceof Error ? error.message : 'Failed to update inquiry.');
    } finally {
      setSavingActivityId(null);
    }
  };

  const handleVisitSave = async (visit: SiteVisit) => {
    setSavingActivityId(visit.id);
    try {
      const updated = await updateSiteVisitStatus(
        visit.id,
        visitStatusDrafts[visit.id] ?? visit.status,
        responseDrafts[visit.id] ?? visit.adminResponse ?? '',
        (visitStatusDrafts[visit.id] ?? visit.status) === 'Scheduled' ? {
          confirmedDate: scheduleDrafts[visit.id]?.date ?? '',
          confirmedTime: scheduleDrafts[visit.id]?.time ?? '',
        } : {}
      );
      setSiteVisits((prev) => prev.map((item) => item.id === visit.id ? updated : item));
      setResponseDrafts((prev) => ({ ...prev, [visit.id]: updated.adminResponse ?? '' }));
      setVisitStatusDrafts((prev) => ({ ...prev, [visit.id]: updated.status }));
      setScheduleDrafts((prev) => ({
        ...prev,
        [visit.id]: {
          date: updated.confirmedDate ? new Date(updated.confirmedDate).toISOString().slice(0, 10) : '',
          time: updated.confirmedTime ?? '',
        },
      }));
      onToast?.('Site visit updated.');
    } catch {
      onToast?.('Failed to update site visit.');
    } finally {
      setSavingActivityId(null);
    }
  };

  const formatDay = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  const visibleInquiries = inquiries.filter((item) => inquiryStatusFilter === 'All'
    || (inquiryStatusFilter === 'Closed'
      ? INQUIRY_CLOSING_STATUSES.includes(item.status as (typeof INQUIRY_CLOSING_STATUSES)[number])
      : item.status === inquiryStatusFilter));
  const visibleSiteVisits = siteVisits.filter((item) => visitStatusFilter === 'All'
    || item.status === visitStatusFilter);
  const pendingInquiryCount = inquiries.filter((item) => item.status === 'Pending').length;
  const pendingVisitCount = siteVisits.filter((item) => item.status === 'Pending').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={load}
          disabled={isInquiryLoading || isSiteVisitLoading}
          className="admin-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60"
          aria-label={isInquiryLoading || isSiteVisitLoading ? 'Refreshing inquiries and site visits' : 'Refresh inquiries and site visits'}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isInquiryLoading || isSiteVisitLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {isInquiryLoading || isSiteVisitLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2" role="tablist" aria-label="Activity request types" aria-orientation="horizontal">
        <button
          id="activities-tab-inquiries"
          type="button"
          role="tab"
          aria-selected={activeTab === 'inquiries'}
          aria-controls="activities-panel-inquiries"
          tabIndex={activeTab === 'inquiries' ? 0 : -1}
          onClick={() => requestTabChange('inquiries')}
          onKeyDown={handleTabKeyDown}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'inquiries' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          Inquiries
          <span title="Count of inquiries currently in Pending status" aria-label={`${pendingInquiryCount} pending inquiries`} className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'inquiries' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {pendingInquiryCount} pending
          </span>
          <span className="sr-only">{pendingInquiryCount} pending inquiries</span>
        </button>
        <button
          id="activities-tab-sitevisits"
          type="button"
          role="tab"
          aria-selected={activeTab === 'sitevisits'}
          aria-controls="activities-panel-sitevisits"
          tabIndex={activeTab === 'sitevisits' ? 0 : -1}
          onClick={() => requestTabChange('sitevisits')}
          onKeyDown={handleTabKeyDown}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'sitevisits' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          Site Visits
          <span title="Count of site visits currently in Pending status" aria-label={`${pendingVisitCount} pending site visits`} className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'sitevisits' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {pendingVisitCount} pending
          </span>
          <span className="sr-only">{pendingVisitCount} pending site visits</span>
        </button>
      </div>

      {/* Inquiries table */}
      <div
        id="activities-panel-inquiries"
        role="tabpanel"
        aria-labelledby="activities-tab-inquiries"
        tabIndex={0}
        hidden={activeTab !== 'inquiries'}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        <div className="admin-panel rounded-2xl overflow-hidden">
          {isInquiryLoading && inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]" role="status" aria-live="polite">Loading inquiries…</div>
          ) : inquiryError && inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-red-700" role="alert">
              <p>{inquiryError}</p>
              <button
                type="button"
                onClick={() => void retryInquiries()}
                disabled={isInquiryLoading}
                className="admin-button-secondary mt-3 px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-60"
                aria-label="Retry loading inquiries"
              >
                Retry
              </button>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]" role="status">No inquiries yet.</div>
          ) : (
            <>
              <div className="px-4 pt-4">
                <label htmlFor="inquiry-status-filter" className="mr-2 text-xs font-semibold text-[#4d5e4d]">Filter inquiries</label>
                <select id="inquiry-status-filter" value={inquiryStatusFilter} onChange={(event) => setInquiryStatusFilter(event.target.value as InquiryStatusFilter)} className="admin-input rounded-lg px-2 py-1.5 text-xs">
                  <option value="All">All</option>
                  <option value="Closed">Closed</option>
                  <option value="Converted">Converted</option>
                  {INQUIRY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              {isInquiryLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]" role="status" aria-live="polite">Refreshing inquiries…</div>}
              {inquiryError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
                  <span>{inquiryError} Existing inquiries are still shown.</span>
                  <button type="button" onClick={() => void retryInquiries()} disabled={isInquiryLoading} className="font-bold underline disabled:opacity-60" aria-label="Retry loading inquiries">Retry</button>
                </div>
              )}
              <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand)]" role="region" aria-label="Inquiry requests table" aria-describedby="inquiry-table-scroll-help" tabIndex={0}>
                <p id="inquiry-table-scroll-help" className="px-4 py-2 text-[10px] font-semibold text-[#7c6a57]">Focus this region and use the arrow keys, or scroll horizontally, to view all columns and actions.</p>
                <table className="w-full min-w-[72rem] text-xs">
              <caption className="sr-only">Buyer inquiries and their current response and status controls</caption>
              <thead>
                <tr className="border-b border-[rgba(78,96,73,0.12)] bg-[rgba(199,211,192,0.18)]">
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Buyer</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Property</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Message</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Admin Response</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Submitted</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Status / Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleInquiries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[#7c6a57]">No inquiries match this status filter.</td></tr>
                ) : visibleInquiries.map((inq) => (
                  <tr
                    id={`activity-record-${inq.id}`}
                    key={inq.id}
                    className={`border-b border-[rgba(78,96,73,0.08)] hover:bg-[rgba(199,211,192,0.1)] transition-colors ${highlightedRecordId === inq.id ? 'bg-amber-100 ring-2 ring-inset ring-amber-500' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2f2417]">{inq.buyerId?.fullName || inq.buyerId?.username}</div>
                      <div className="text-[#7c6a57] text-[10px]">{inq.buyerId?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2f2417]">{inq.propertyId?.name}</div>
                      <div className="text-[#7c6a57] text-[10px]">{inq.propertyId?.location}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-[#4d5e4d] leading-relaxed line-clamp-3">{inq.message}</p>
                    </td>
                    <td className="px-4 py-3 min-w-64">
                      <label htmlFor={`inquiry-response-${inq.id}`} className="sr-only">Admin Response</label>
                      <textarea
                        id={`inquiry-response-${inq.id}`}
                        value={responseDrafts[inq.id] ?? ''}
                        onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                        maxLength={2000}
                        rows={3}
                        placeholder="Enter a response for the buyer..."
                        disabled={inq.status === 'Converted' || INQUIRY_CLOSING_STATUSES.includes(inq.status as (typeof INQUIRY_CLOSING_STATUSES)[number])}
                        className="admin-input text-[10px] py-1.5 px-2 rounded-lg w-full resize-y disabled:cursor-not-allowed disabled:opacity-75"
                      />
                    </td>
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">
                      <div>Submitted: {formatActivityTimestamp(inq.createdAt)}</div>
                      {inq.updatedAt && <div className="mt-1 text-[10px]">Updated {formatActivityTimestamp(inq.updatedAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(inquiryStatusDrafts[inq.id] ?? inq.status)}
                        {inquiryNeedsReview(inq) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900" title="Saved inquiry status and response do not match. Review and save this record.">Needs review</span>}
                        {inq.status === 'Converted' ? (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-teal-900">Inquiry converted</p>
                            {transactions.filter((transaction) => transaction.convertedInquiryId === inq.id).map((transaction) => (
                              <div key={transaction.id} className="rounded-lg bg-teal-50 px-2 py-1.5 text-[10px] text-teal-950">
                                <div>Transaction ID: <button type="button" onClick={() => onOpenTransaction?.(transaction.id)} className="font-mono break-all underline decoration-current underline-offset-2 hover:text-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700" aria-label={`Open transaction ${transaction.id}`}>{transaction.id}</button></div>
                                <div className="font-semibold">Status: {transaction.status}{transaction.status === 'Cancelled' ? ' — transaction cancelled' : ''}</div>
                              </div>
                            ))}
                            {!transactions.some((transaction) => transaction.convertedInquiryId === inq.id) && (
                              <p className="text-[10px] text-neutral-600">Linked transaction details are unavailable. Refresh to retry.</p>
                            )}
                          </div>
                        ) : null}
                        {inq.status !== 'Converted' && <select
                          id={`inquiry-status-${inq.id}`}
                          value={inquiryStatusDrafts[inq.id] ?? inq.status}
                          onChange={(e) => setInquiryStatusDrafts((prev) => ({ ...prev, [inq.id]: e.target.value as Inquiry['status'] }))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                          aria-label={`Status for inquiry from ${inq.buyerId?.fullName || inq.buyerId?.username || 'buyer'} about ${inq.propertyId?.name || 'property'}`}
                        >
                          {(INQUIRY_CLOSING_STATUSES.includes(inq.status as (typeof INQUIRY_CLOSING_STATUSES)[number]) ? [inq.status] : INQUIRY_STATUSES).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>}
                        {(inq.status === 'Pending' || inq.status === 'Responded') && (
                          <button
                            type="button"
                            onClick={() => void openConversionForm(inq)}
                            disabled={isLoadingConversionProperties}
                            aria-label={`Create transaction from inquiry about ${inq.propertyId?.name || 'property'}`}
                            className="admin-button-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer disabled:opacity-60"
                          >
                            <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
                            {isLoadingConversionProperties ? 'Loading…' : 'Create transaction'}
                          </button>
                        )}
                        {INQUIRY_CLOSING_STATUSES.includes((inquiryStatusDrafts[inq.id] ?? inq.status) as (typeof INQUIRY_CLOSING_STATUSES)[number]) && (
                          <div className="w-full">
                            <label htmlFor={`inquiry-close-reason-${inq.id}`} className="mb-1 block text-[10px] font-semibold text-[#4d5e4d]">Reason <span aria-hidden="true">*</span></label>
                            <textarea
                              id={`inquiry-close-reason-${inq.id}`}
                              value={closeReasonDrafts[inq.id] ?? inq.closeReason ?? ''}
                              onChange={(event) => setCloseReasonDrafts((prev) => ({ ...prev, [inq.id]: event.target.value }))}
                              maxLength={500}
                              rows={2}
                              required
                              aria-label={`Required close reason for inquiry about ${inq.propertyId?.name || 'property'}`}
                              className="admin-input w-full resize-y rounded-lg px-2 py-1.5 text-[10px]"
                            />
                          </div>
                        )}
                        {isInquiryDirty(inq) && <span className="text-[10px] font-semibold text-amber-800">Unsaved changes</span>}
                        {inq.status !== 'Converted' && !INQUIRY_CLOSING_STATUSES.includes(inq.status as (typeof INQUIRY_CLOSING_STATUSES)[number]) && (
                        <button
                          type="button"
                          onClick={() => handleInquirySave(inq)}
                          disabled={savingActivityId === inq.id || !isInquiryDirty(inq) || (INQUIRY_CLOSING_STATUSES.includes((inquiryStatusDrafts[inq.id] ?? inq.status) as (typeof INQUIRY_CLOSING_STATUSES)[number]) && !(closeReasonDrafts[inq.id] ?? inq.closeReason ?? '').trim())}
                          className="admin-button text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60"
                          aria-label={`${savingActivityId === inq.id ? 'Saving' : 'Save'} inquiry response for ${inq.buyerId?.fullName || inq.buyerId?.username || 'buyer'}`}
                        >
                          {savingActivityId === inq.id ? 'Saving…' : 'Save'}
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <TransactionFormModal
        isOpen={Boolean(conversionContext)}
        properties={transactionProperties}
        conversionContext={conversionContext}
        isLoadingConversionProperty={isLoadingConversionProperties}
        onClose={() => setConversionContext(null)}
        onCreated={handleConvertedTransactionCreated}
      />

      {/* Site Visits table */}
      <div
        id="activities-panel-sitevisits"
        role="tabpanel"
        aria-labelledby="activities-tab-sitevisits"
        tabIndex={0}
        hidden={activeTab !== 'sitevisits'}
        className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      >
        <div className="admin-panel rounded-2xl overflow-hidden">
          {isSiteVisitLoading && siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]" role="status" aria-live="polite">Loading site visits…</div>
          ) : siteVisitError && siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-red-700" role="alert">
              <p>{siteVisitError}</p>
              <button
                type="button"
                onClick={() => void retrySiteVisits()}
                disabled={isSiteVisitLoading}
                className="admin-button-secondary mt-3 px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-60"
                aria-label="Retry loading site visits"
              >
                Retry
              </button>
            </div>
          ) : siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]" role="status">No site visit requests yet.</div>
          ) : (
            <>
              <div className="px-4 pt-4">
                <label htmlFor="site-visit-status-filter" className="mr-2 text-xs font-semibold text-[#4d5e4d]">Filter site visits</label>
                <select id="site-visit-status-filter" value={visitStatusFilter} onChange={(event) => setVisitStatusFilter(event.target.value as VisitStatusFilter)} className="admin-input rounded-lg px-2 py-1.5 text-xs">
                  <option value="All">All</option>
                  {VISIT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              {isSiteVisitLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]" role="status" aria-live="polite">Refreshing site visits…</div>}
              {siteVisitError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
                  <span>{siteVisitError} Existing site visits are still shown.</span>
                  <button type="button" onClick={() => void retrySiteVisits()} disabled={isSiteVisitLoading} className="font-bold underline disabled:opacity-60" aria-label="Retry loading site visits">Retry</button>
                </div>
              )}
              <div className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand)]" role="region" aria-label="Site visit requests table" aria-describedby="site-visits-table-scroll-help" tabIndex={0}>
                <p id="site-visits-table-scroll-help" className="px-4 py-2 text-[10px] font-semibold text-[#7c6a57]">Focus this region and use the arrow keys, or scroll horizontally, to view all columns and actions.</p>
                <table className="w-full min-w-[80rem] text-xs">
              <caption className="sr-only">Site visit requests and their current response and status controls</caption>
              <thead>
                <tr className="border-b border-[rgba(78,96,73,0.12)] bg-[rgba(199,211,192,0.18)]">
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Buyer</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Property</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Preferred Date</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Preferred Time</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Notes</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Admin Response</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Submitted</th>
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleSiteVisits.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-[#7c6a57]">No site visits match this status filter.</td></tr>
                ) : visibleSiteVisits.map((v) => (
                  <tr
                    id={`activity-record-${v.id}`}
                    key={v.id}
                    className={`border-b border-[rgba(78,96,73,0.08)] hover:bg-[rgba(199,211,192,0.1)] transition-colors ${highlightedRecordId === v.id ? 'bg-amber-100 ring-2 ring-inset ring-amber-500' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2f2417]">{v.buyerId?.fullName || v.buyerId?.username}</div>
                      <div className="text-[#7c6a57] text-[10px]">{v.buyerId?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#2f2417]">{v.propertyId?.name}</div>
                      <div className="text-[#7c6a57] text-[10px]">{v.propertyId?.location}</div>
                    </td>
                    <td className="px-4 py-3 text-[#4d5e4d] whitespace-nowrap">{formatDay(v.preferredDate)}</td>
                    <td className="px-4 py-3 text-[#4d5e4d] whitespace-nowrap">{v.preferredTime || '—'}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-[#4d5e4d] leading-relaxed line-clamp-3">{v.notes || '—'}</p>
                    </td>
                    <td className="px-4 py-3 min-w-64">
                      <label htmlFor={`visit-response-${v.id}`} className="sr-only">Admin Response</label>
                      <textarea
                        id={`visit-response-${v.id}`}
                        value={responseDrafts[v.id] ?? ''}
                        onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [v.id]: e.target.value }))}
                        maxLength={2000}
                        rows={3}
                        placeholder="Enter scheduling details or a response..."
                        className="admin-input text-[10px] py-1.5 px-2 rounded-lg w-full resize-y"
                      />
                    </td>
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">
                      <div>Submitted: {formatActivityTimestamp(v.createdAt)}</div>
                      {v.updatedAt && <div className="mt-1 text-[10px]">Updated {formatActivityTimestamp(v.updatedAt)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(visitStatusDrafts[v.id] ?? v.status)}
                        <select
                          id={`site-visit-status-${v.id}`}
                          value={visitStatusDrafts[v.id] ?? v.status}
                          onChange={(e) => setVisitStatusDrafts((prev) => ({ ...prev, [v.id]: e.target.value as SiteVisit['status'] }))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                          aria-label={`Status for site visit from ${v.buyerId?.fullName || v.buyerId?.username || 'buyer'} about ${v.propertyId?.name || 'property'}`}
                        >
                          {VISIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {(visitStatusDrafts[v.id] ?? v.status) === 'Scheduled' && (
                          <div className="flex flex-col gap-1.5 w-full min-w-36">
                            <label htmlFor={`site-visit-confirmed-date-${v.id}`} className="text-[10px] font-semibold text-[#4d5e4d]">Confirmed date</label>
                            <input
                              id={`site-visit-confirmed-date-${v.id}`}
                              type="date"
                              value={scheduleDrafts[v.id]?.date ?? ''}
                              onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [v.id]: { date: e.target.value, time: prev[v.id]?.time ?? '' } }))}
                              className="admin-input text-[10px] py-1 px-2 rounded-lg w-full"
                            />
                            <label htmlFor={`site-visit-confirmed-time-${v.id}`} className="text-[10px] font-semibold text-[#4d5e4d]">Confirmed time</label>
                            <input
                              id={`site-visit-confirmed-time-${v.id}`}
                              type="time"
                              value={scheduleDrafts[v.id]?.time ?? ''}
                              onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [v.id]: { date: prev[v.id]?.date ?? '', time: e.target.value } }))}
                              className="admin-input text-[10px] py-1 px-2 rounded-lg w-full"
                            />
                          </div>
                        )}
                        {isVisitDirty(v) && <span className="text-[10px] font-semibold text-amber-800">Unsaved changes</span>}
                        <button
                          type="button"
                          onClick={() => handleVisitSave(v)}
                          disabled={savingActivityId === v.id || !isVisitDirty(v)}
                          className="admin-button text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60"
                          aria-label={`${savingActivityId === v.id ? 'Saving' : 'Save'} site visit response for ${v.buyerId?.fullName || v.buyerId?.username || 'buyer'}`}
                        >
                          {savingActivityId === v.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
