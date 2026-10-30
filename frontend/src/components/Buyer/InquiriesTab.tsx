import React, { useState, useMemo } from 'react';
import {
  Mail,
  RefreshCw,
  Clock,
  CheckCircle2,
  MapPin,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Search,
  Filter,
  Trees,
  Building2,
  Home,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import type { Inquiry } from '../../services/InquiryService';
import type { Property } from '../../types/types';
import { formatActivityTimestamp } from '../../utils/activityTimestamp';

const TYPE_ICON: Record<string, React.ElementType> = {
  Agricultural: Trees,
  Commercial: Building2,
  Condominium: Building2,
  'House & Lot': Home,
  Residential: Home,
};
const renderTypeIcon = (type?: string, className?: string) => {
  const IconComponent = (type && TYPE_ICON[type]) || Landmark;
  return <IconComponent className={className} />;
};

interface InquiriesTabProps {
  inquiries: Inquiry[];
  properties: Property[];
  isLoading: boolean;
  error?: string;
  onRefresh: () => void;
  onSelectProperty: (property: Property) => void;
  onBrowseProperties: () => void;
}

type StatusFilter = 'All' | 'Pending' | 'Responded';

// Helper to extract topic prefix if present
function parseInquiryMessage(rawMessage: string): { topic: string | null; body: string } {
  const match = rawMessage.match(/^\[Topic:\s*([^\]]+)\]\s*\n*/i);
  if (match) {
    return {
      topic: match[1].trim(),
      body: rawMessage.slice(match[0].length).trim(),
    };
  }
  return { topic: null, body: rawMessage };
}

export const InquiriesTab: React.FC<InquiriesTabProps> = ({
  inquiries,
  properties,
  isLoading,
  error,
  onRefresh,
  onSelectProperty,
  onBrowseProperties,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Map properties by ID for quick lookup
  const propertyMap = useMemo(() => {
    const map = new Map<string, Property>();
    for (const p of properties) {
      if (p.id) map.set(p.id, p);
    }
    return map;
  }, [properties]);

  // Counts for tabs
  const pendingCount = useMemo(
    () => inquiries.filter((i) => i.status === 'Pending').length,
    [inquiries]
  );
  const respondedCount = useMemo(
    () => inquiries.filter((i) => i.status === 'Responded').length,
    [inquiries]
  );

  // Filtered inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inquiry) => {
      // Status filter
      if (statusFilter !== 'All' && inquiry.status !== statusFilter) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const propName = inquiry.propertyId?.name?.toLowerCase() ?? '';
        const propLoc = inquiry.propertyId?.location?.toLowerCase() ?? '';
        const msg = inquiry.message?.toLowerCase() ?? '';
        const adminResp = inquiry.adminResponse?.toLowerCase() ?? '';
        if (
          !propName.includes(query) &&
          !propLoc.includes(query) &&
          !msg.includes(query) &&
          !adminResp.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [inquiries, statusFilter, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
      {/* Page Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#0D1F1A] rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-[rgba(40,90,72,0.2)] shadow-md">
          <Mail className="w-7 h-7 sm:w-8 sm:h-8 text-[#B0E4CC]" />
        </div>
        <h2 className="font-serif text-2xl sm:text-3xl text-[#1A2D24] font-semibold tracking-tight">
          My Inquiries
        </h2>
        <p className="text-xs sm:text-sm text-[#5A7A6A] mt-1.5 max-w-md mx-auto">
          Track the status of your property questions and responses from the TerraGuide team.
        </p>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh inquiries list"
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-[rgba(40,90,72,0.25)] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-semibold text-[#285A48] hover:bg-[#E8F5EF] transition-all shadow-sm disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Refreshing…' : 'Refresh Inquiries'}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800 shadow-sm"
        >
          <div className="flex items-center justify-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="mt-2.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      {inquiries.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-[#EAE6DF] p-1 rounded-xl">
            {(
              [
                { id: 'All', label: 'All', count: inquiries.length },
                { id: 'Pending', label: 'Pending', count: pendingCount },
                { id: 'Responded', label: 'Responded', count: respondedCount },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1A2D24] text-[#FFFFFF] shadow-sm'
                      : 'text-[#5A7A6A] hover:text-[#1A2D24]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-[#285A48] text-[#B0E4CC]'
                        : 'bg-[#D8D2C7] text-[#5A7A6A]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#5A7A6A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inquiries or properties..."
              className="w-full bg-[#FFFFFF] border border-neutral-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#1A2D24] placeholder:text-[#8FA59A] focus:outline-none focus:border-[#285A48] focus:ring-1 focus:ring-[#285A48] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#5A7A6A] hover:text-[#1A2D24]"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content Area */}
      {isLoading && inquiries.length === 0 ? (
        <div className="rounded-2xl bg-[#0D1F1A] p-10 text-center text-sm text-[#B0E4CC] border border-[rgba(40,90,72,0.2)]">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#B0E4CC]" />
          Loading your inquiries…
        </div>
      ) : inquiries.length === 0 ? (
        /* Empty State: No inquiries at all */
        <div className="rounded-2xl bg-[#0D1F1A] p-8 sm:p-12 text-center border border-[rgba(40,90,72,0.2)] shadow-lg">
          <div className="w-16 h-16 bg-[#122A20] rounded-2xl flex items-center justify-center mx-auto mb-4 border border-[rgba(40,90,72,0.25)]">
            <MessageSquare className="w-8 h-8 text-[#6A9F8A]" />
          </div>
          <h3 className="font-serif text-xl text-[#FFFFFF] font-semibold">No inquiries yet</h3>
          <p className="text-xs sm:text-sm text-[#6A9F8A] mt-2 max-w-sm mx-auto leading-relaxed">
            When you view properties that interest you, click "Send Inquiry" to ask questions about pricing, documents, or scheduling.
          </p>
          <button
            type="button"
            onClick={onBrowseProperties}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#285A48] hover:bg-[#34735c] px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#FFFFFF] shadow-md transition-all cursor-pointer"
          >
            <span>Explore Available Properties</span>
          </button>
        </div>
      ) : filteredInquiries.length === 0 ? (
        /* Empty Filter State */
        <div className="rounded-2xl bg-[#FFFFFF] p-8 sm:p-10 text-center border border-neutral-200 shadow-sm">
          <Filter className="w-8 h-8 text-[#6A9F8A] mx-auto mb-2 opacity-50" />
          <h4 className="font-serif text-base font-semibold text-[#1A2D24]">
            No matching inquiries found
          </h4>
          <p className="text-xs text-[#5A7A6A] mt-1">
            Try adjusting your status filter or clearing your search query.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('All');
              setSearchQuery('');
            }}
            className="mt-4 text-xs font-semibold text-[#285A48] hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Inquiries List */
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => {
            const propId = inquiry.propertyId?.id;
            const fullProperty = propId ? propertyMap.get(propId) : null;
            const { topic, body } = parseInquiryMessage(inquiry.message);
            const imageUrl = fullProperty?.images?.[0];

            return (
              <div
                key={inquiry.id}
                className="bg-[#0D1F1A] rounded-2xl p-5 sm:p-6 border border-[rgba(40,90,72,0.22)] shadow-md hover:border-[rgba(40,90,72,0.4)] transition-all"
              >
                {/* Header: Property info & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-[rgba(40,90,72,0.18)]">
                  <div className="flex items-start gap-3.5">
                    {/* Property Thumbnail if available */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 bg-[#122A20] border border-[rgba(40,90,72,0.2)] flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={inquiry.propertyId?.name ?? 'Property'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        renderTypeIcon(inquiry.propertyId?.type || fullProperty?.type, 'w-6 h-6 text-[#408A71]')
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif font-semibold text-base sm:text-lg text-[#FFFFFF]">
                          {inquiry.propertyId?.name ?? 'Unknown property'}
                        </h3>
                        {inquiry.propertyId?.type && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#122A20] text-[#B0E4CC] border border-[rgba(40,90,72,0.2)]">
                            {inquiry.propertyId.type}
                          </span>
                        )}
                      </div>

                      {inquiry.propertyId?.location && (
                        <p className="flex items-center gap-1 text-xs text-[#6A9F8A] mt-1">
                          <MapPin className="w-3 h-3 text-[#408A71] shrink-0" />
                          <span>{inquiry.propertyId.location}</span>
                        </p>
                      )}

                      <p className="text-[11px] text-[#6A9F8A] mt-1">
                        Submitted: {formatActivityTimestamp(inquiry.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge & Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 pt-2 sm:pt-0">
                    {inquiry.status === 'Responded' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Responded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        Pending Response
                      </span>
                    )}

                    {/* View Property button if available in portal */}
                    {fullProperty && (
                      <button
                        type="button"
                        onClick={() => onSelectProperty(fullProperty)}
                        className="inline-flex items-center gap-1 text-xs text-[#B0E4CC] hover:text-[#FFFFFF] transition-colors cursor-pointer font-medium hover:underline"
                      >
                        <span>View Property</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inquiry Message Section */}
                <div className="mt-4">
                  {topic && (
                    <div className="mb-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#1A3D2F] text-[#B0E4CC] border border-[rgba(40,90,72,0.3)]">
                        Topic: {topic}
                      </span>
                    </div>
                  )}

                  <div className="bg-[#091413] rounded-xl p-3.5 sm:p-4 border border-[rgba(40,90,72,0.18)]">
                    <p className="text-xs uppercase tracking-wider font-semibold text-[#6A9F8A] mb-1">
                      Your Message
                    </p>
                    <p className="text-sm text-[#E8F5EF] leading-relaxed whitespace-pre-wrap">
                      {body}
                    </p>
                  </div>
                </div>

                {/* Official Admin Response Section */}
                {inquiry.adminResponse && (
                  <div className="mt-3.5 rounded-xl border border-[rgba(176,228,204,0.25)] bg-[rgba(26,61,47,0.45)] p-4 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#B0E4CC]" />
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#B0E4CC]">
                        TerraGuide Admin Response
                      </p>
                    </div>
                    <p className="text-sm text-[#E8F5EF] leading-relaxed whitespace-pre-wrap pl-5 border-l-2 border-[#408A71]/50">
                      {inquiry.adminResponse}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InquiriesTab;
