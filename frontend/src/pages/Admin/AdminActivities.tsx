import React, { useEffect, useState } from 'react';
import { formatActivityTimestamp } from '../../utils/activityTimestamp';
import { Mail, Calendar, RefreshCw } from 'lucide-react';
import { getAllInquiries, updateInquiryStatus } from '../../services/InquiryService';
import type { Inquiry } from '../../services/InquiryService';
import { getAllSiteVisits, updateSiteVisitStatus } from '../../services/SiteVisitService';
import type { SiteVisit } from '../../services/SiteVisitService';

interface AdminActivitiesProps {
  onToast?: (message: string) => void;
}

const INQUIRY_STATUSES = ['Pending', 'Responded'] as const;
const VISIT_STATUSES = ['Pending', 'Scheduled', 'Completed'] as const;

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-100 text-amber-800',
    Responded: 'bg-emerald-100 text-emerald-800',
    Scheduled: 'bg-blue-100 text-blue-800',
    Completed: 'bg-emerald-100 text-emerald-800',
  };
  return (
    <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-neutral-100 text-neutral-700'}`}>
      {status}
    </span>
  );
};

export const AdminActivities: React.FC<AdminActivitiesProps> = ({ onToast }) => {
  const [activeTab, setActiveTab] = useState<'inquiries' | 'sitevisits'>('inquiries');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [siteVisits, setSiteVisits] = useState<SiteVisit[]>([]);
  const [isInquiryLoading, setIsInquiryLoading] = useState(true);
  const [isSiteVisitLoading, setIsSiteVisitLoading] = useState(true);
  const [inquiryError, setInquiryError] = useState('');
  const [siteVisitError, setSiteVisitError] = useState('');
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({});
  const [savingActivityId, setSavingActivityId] = useState<string | null>(null);

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
    setActiveTab(nextTab);
    document.getElementById(`activities-tab-${nextTab}`)?.focus();
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
    } catch {
      setSiteVisitError('Could not load site visits. Please try again.');
    } finally {
      setIsSiteVisitLoading(false);
    }
  };

  const load = async () => {
    if (isInquiryLoading || isSiteVisitLoading) return;
    await Promise.all([loadInquiries(), loadSiteVisits()]);
  };

  useEffect(() => {
    void Promise.all([loadInquiries(), loadSiteVisits()]);
  }, []);

  const handleInquirySave = async (inquiry: Inquiry) => {
    setSavingActivityId(inquiry.id);
    try {
      const updated = await updateInquiryStatus(
        inquiry.id,
        inquiry.status,
        responseDrafts[inquiry.id] ?? inquiry.adminResponse ?? ''
      );
      setInquiries((prev) => prev.map((item) => item.id === inquiry.id ? updated : item));
      setResponseDrafts((prev) => ({ ...prev, [inquiry.id]: updated.adminResponse ?? '' }));
      onToast?.('Inquiry updated.');
    } catch {
      onToast?.('Failed to update inquiry.');
    } finally {
      setSavingActivityId(null);
    }
  };

  const handleVisitSave = async (visit: SiteVisit) => {
    setSavingActivityId(visit.id);
    try {
      const updated = await updateSiteVisitStatus(
        visit.id,
        visit.status,
        responseDrafts[visit.id] ?? visit.adminResponse ?? ''
      );
      setSiteVisits((prev) => prev.map((item) => item.id === visit.id ? updated : item));
      setResponseDrafts((prev) => ({ ...prev, [visit.id]: updated.adminResponse ?? '' }));
      onToast?.('Site visit updated.');
    } catch {
      onToast?.('Failed to update site visit.');
    } finally {
      setSavingActivityId(null);
    }
  };

  const formatDay = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

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
          onClick={() => setActiveTab('inquiries')}
          onKeyDown={handleTabKeyDown}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'inquiries' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Mail className="w-3.5 h-3.5" aria-hidden="true" />
          Inquiries
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'inquiries' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {inquiries.filter((i) => i.status === 'Pending').length}
          </span>
        </button>
        <button
          id="activities-tab-sitevisits"
          type="button"
          role="tab"
          aria-selected={activeTab === 'sitevisits'}
          aria-controls="activities-panel-sitevisits"
          tabIndex={activeTab === 'sitevisits' ? 0 : -1}
          onClick={() => setActiveTab('sitevisits')}
          onKeyDown={handleTabKeyDown}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'sitevisits' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          Site Visits
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'sitevisits' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {siteVisits.filter((v) => v.status === 'Pending').length}
          </span>
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
                onClick={() => void loadInquiries()}
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
              {isInquiryLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]" role="status" aria-live="polite">Refreshing inquiries…</div>}
              {inquiryError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
                  <span>{inquiryError} Existing inquiries are still shown.</span>
                  <button type="button" onClick={() => void loadInquiries()} disabled={isInquiryLoading} className="font-bold underline disabled:opacity-60" aria-label="Retry loading inquiries">Retry</button>
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
                  <th scope="col" className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="border-b border-[rgba(78,96,73,0.08)] hover:bg-[rgba(199,211,192,0.1)] transition-colors">
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
                        className="admin-input text-[10px] py-1.5 px-2 rounded-lg w-full resize-y"
                      />
                    </td>
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">{formatActivityTimestamp(inq.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(inq.status)}
                        <select
                          id={`inquiry-status-${inq.id}`}
                          value={inq.status}
                          onChange={(e) => setInquiries((prev) => prev.map((item) => item.id === inq.id
                            ? { ...item, status: e.target.value as 'Pending' | 'Responded' }
                            : item))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                          aria-label={`Status for inquiry from ${inq.buyerId?.fullName || inq.buyerId?.username || 'buyer'} about ${inq.propertyId?.name || 'property'}`}
                        >
                          {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleInquirySave(inq)}
                          disabled={savingActivityId === inq.id}
                          className="admin-button text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60"
                          aria-label={`${savingActivityId === inq.id ? 'Saving' : 'Save'} inquiry response for ${inq.buyerId?.fullName || inq.buyerId?.username || 'buyer'}`}
                        >
                          {savingActivityId === inq.id ? 'Saving…' : 'Save'}
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
                onClick={() => void loadSiteVisits()}
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
              {isSiteVisitLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]" role="status" aria-live="polite">Refreshing site visits…</div>}
              {siteVisitError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700" role="alert">
                  <span>{siteVisitError} Existing site visits are still shown.</span>
                  <button type="button" onClick={() => void loadSiteVisits()} disabled={isSiteVisitLoading} className="font-bold underline disabled:opacity-60" aria-label="Retry loading site visits">Retry</button>
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
                {siteVisits.map((v) => (
                  <tr key={v.id} className="border-b border-[rgba(78,96,73,0.08)] hover:bg-[rgba(199,211,192,0.1)] transition-colors">
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
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">{formatActivityTimestamp(v.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(v.status)}
                        <select
                          id={`site-visit-status-${v.id}`}
                          value={v.status}
                          onChange={(e) => setSiteVisits((prev) => prev.map((item) => item.id === v.id
                            ? { ...item, status: e.target.value as 'Pending' | 'Scheduled' | 'Completed' }
                            : item))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                          aria-label={`Status for site visit from ${v.buyerId?.fullName || v.buyerId?.username || 'buyer'} about ${v.propertyId?.name || 'property'}`}
                        >
                          {VISIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleVisitSave(v)}
                          disabled={savingActivityId === v.id}
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
