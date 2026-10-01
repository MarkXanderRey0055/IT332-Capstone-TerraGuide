import React, { useEffect, useState } from 'react';
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  const formatDay = (d: string) =>
    new Date(d).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="admin-panel rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[#2f2417] font-serif text-lg font-bold">Buyer Activities</h2>
          <p className="text-[#7c6a57] text-xs mt-0.5">Inquiries and site-visit requests from buyers.</p>
        </div>
        <button
          onClick={load}
          disabled={isInquiryLoading || isSiteVisitLoading}
          className="admin-button-secondary flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isInquiryLoading || isSiteVisitLoading ? 'animate-spin' : ''}`} />
          {isInquiryLoading || isSiteVisitLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'inquiries' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Mail className="w-3.5 h-3.5" />
          Inquiries
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'inquiries' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {inquiries.filter((i) => i.status === 'Pending').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sitevisits')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer border-none ${activeTab === 'sitevisits' ? 'admin-button text-white' : 'admin-panel text-[#7c6a57] hover:text-[#2f2417]'}`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Site Visits
          <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'sitevisits' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'}`}>
            {siteVisits.filter((v) => v.status === 'Pending').length}
          </span>
        </button>
      </div>

      {/* Inquiries table */}
      {activeTab === 'inquiries' && (
        <div className="admin-panel rounded-2xl overflow-hidden">
          {isInquiryLoading && inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]">Loading inquiries…</div>
          ) : inquiryError && inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-red-700">
              <p>{inquiryError}</p>
              <button
                type="button"
                onClick={() => void loadInquiries()}
                disabled={isInquiryLoading}
                className="admin-button-secondary mt-3 px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-60"
              >
                Retry
              </button>
            </div>
          ) : inquiries.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]">No inquiries yet.</div>
          ) : (
            <>
              {isInquiryLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]">Refreshing inquiries…</div>}
              {inquiryError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                  <span>{inquiryError} Existing inquiries are still shown.</span>
                  <button type="button" onClick={() => void loadInquiries()} disabled={isInquiryLoading} className="font-bold underline disabled:opacity-60">Retry</button>
                </div>
              )}
              <div className="overflow-x-auto">
                <p className="px-4 py-2 text-[10px] font-semibold text-[#7c6a57]">Scroll horizontally to view all columns and actions.</p>
                <table className="w-full min-w-[72rem] text-xs">
              <thead>
                <tr className="border-b border-[rgba(78,96,73,0.12)] bg-[rgba(199,211,192,0.18)]">
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Buyer</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Property</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Message</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Admin Response</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Date</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Status</th>
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
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">{formatDate(inq.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(inq.status)}
                        <select
                          value={inq.status}
                          onChange={(e) => setInquiries((prev) => prev.map((item) => item.id === inq.id
                            ? { ...item, status: e.target.value as 'Pending' | 'Responded' }
                            : item))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                        >
                          {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleInquirySave(inq)}
                          disabled={savingActivityId === inq.id}
                          className="admin-button text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60"
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
      )}

      {/* Site Visits table */}
      {activeTab === 'sitevisits' && (
        <div className="admin-panel rounded-2xl overflow-hidden">
          {isSiteVisitLoading && siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]">Loading site visits…</div>
          ) : siteVisitError && siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-red-700">
              <p>{siteVisitError}</p>
              <button
                type="button"
                onClick={() => void loadSiteVisits()}
                disabled={isSiteVisitLoading}
                className="admin-button-secondary mt-3 px-3 py-1.5 rounded-lg font-bold cursor-pointer disabled:opacity-60"
              >
                Retry
              </button>
            </div>
          ) : siteVisits.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7c6a57]">No site visit requests yet.</div>
          ) : (
            <>
              {isSiteVisitLoading && <div className="px-4 py-2 text-xs text-[#7c6a57]">Refreshing site visits…</div>}
              {siteVisitError && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                  <span>{siteVisitError} Existing site visits are still shown.</span>
                  <button type="button" onClick={() => void loadSiteVisits()} disabled={isSiteVisitLoading} className="font-bold underline disabled:opacity-60">Retry</button>
                </div>
              )}
              <div className="overflow-x-auto">
                <p className="px-4 py-2 text-[10px] font-semibold text-[#7c6a57]">Scroll horizontally to view all columns and actions.</p>
                <table className="w-full min-w-[80rem] text-xs">
              <thead>
                <tr className="border-b border-[rgba(78,96,73,0.12)] bg-[rgba(199,211,192,0.18)]">
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Buyer</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Property</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Preferred Date</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Notes</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Admin Response</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Submitted</th>
                  <th className="text-left px-4 py-3 text-[#4d5e4d] font-bold uppercase tracking-wide text-[10px]">Status</th>
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
                    <td className="px-4 py-3 text-[#7c6a57] whitespace-nowrap">{formatDate(v.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {statusBadge(v.status)}
                        <select
                          value={v.status}
                          onChange={(e) => setSiteVisits((prev) => prev.map((item) => item.id === v.id
                            ? { ...item, status: e.target.value as 'Pending' | 'Scheduled' | 'Completed' }
                            : item))}
                          className="admin-input text-[10px] py-1 px-2 rounded-lg cursor-pointer w-fit"
                        >
                          {VISIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleVisitSave(v)}
                          disabled={savingActivityId === v.id}
                          className="admin-button text-white text-[10px] font-bold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-60"
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
      )}
    </div>
  );
};
