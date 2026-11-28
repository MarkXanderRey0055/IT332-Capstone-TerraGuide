import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Target,
  Users,
  Home,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';
import type { AdminBuyerProfile } from '../../services/AdminBuyerService';
import type { PropertyRanking, TypeDecision } from '../../services/AnalyticsService';
import type { Property } from '../../types/types';
import type { AdminAnalyticsNavigateTarget } from '../../pages/Admin/AdminAnalytics';

export interface TypeDecisionDrilldownModalProps {
  decision: TypeDecision | null;
  nullDemandCount?: number;
  onClose: () => void;
  buyers: AdminBuyerProfile[] | null;
  buyersLoading: boolean;
  buyersError: string;
  onRetryBuyers: () => void;
  properties: Property[] | null;
  propertiesLoading: boolean;
  propertiesError: string;
  onRetryProperties: () => void;
  rankings: PropertyRanking[];
  onNavigate?: (target: AdminAnalyticsNavigateTarget) => void;
}

const DECISION_BADGE: Record<
  TypeDecision['decision'],
  { label: string; className: string; panelAccent: string }
> = {
  shortage: {
    label: 'Source or promote',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    panelAccent: 'bg-emerald-50/60 border-emerald-200/80',
  },
  surplus: {
    label: 'Hold',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    panelAccent: 'bg-amber-50/60 border-amber-200/80',
  },
  insufficient_sample: {
    label: 'Insufficient sample',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
    panelAccent: 'bg-white/70 border-[#d6c7b2]',
  },
  within_range: {
    label: 'Within range',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
    panelAccent: 'bg-white/70 border-[#d6c7b2]',
  },
  no_records: {
    label: 'No records',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
    panelAccent: 'bg-white/70 border-[#d6c7b2]',
  },
  insufficient_data: {
    label: 'Not enough data',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
    panelAccent: 'bg-white/70 border-[#d6c7b2]',
  },
};

function formatPeso(value: number): string {
  return `₱${Math.round(value).toLocaleString('en-US')}`;
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

function formatReadinessLabel(riskLevel: PropertyRanking['riskLevel']): string {
  if (riskLevel === 'Low') return 'Ready for Presentation';
  if (riskLevel === 'Medium') return 'Needs Document Review';
  return 'High Risk';
}

function buildPlainLanguageGuidance(item: TypeDecision): {
  recommendedAction: string;
  explanation: string;
} {
  switch (item.decision) {
    case 'shortage': {
      const listingWord = item.blockingCount === 1 ? 'listing' : 'listings';
      if (item.blockingCount > 0) {
        return {
          recommendedAction: `Review documents on ${item.blockingCount} existing ${item.type} ${listingWord} first, then source more.`,
          explanation:
            'More buyers are interested in this property type than there are available listings, but some available properties need document review before they can be considered ready.',
        };
      }
      return {
        recommendedAction: `Source or promote more ${item.type} listings.`,
        explanation:
          'More buyers are interested in this property type than there are available listings.',
      };
    }
    case 'surplus': {
      const listingWord = item.unauditedCount === 1 ? 'listing' : 'listings';
      if (item.unauditedCount > 0) {
        return {
          recommendedAction: `Complete document checks on ${item.unauditedCount} ${item.type} ${listingWord} before making pricing or promotion changes.`,
          explanation:
            'There are more available listings of this property type than current buyer interest, and some available properties have not been assessed yet.',
        };
      }
      return {
        recommendedAction: `Hold off on adding more ${item.type} listings for now.`,
        explanation:
          'There are more available listings of this property type than current buyer interest.',
      };
    }
    case 'within_range':
      return {
        recommendedAction: 'No action needed right now.',
        explanation:
          'Buyer interest and available supply for this property type are reasonably balanced.',
      };
    case 'insufficient_sample':
      return {
        recommendedAction: 'Not enough buyer information to make a reliable recommendation yet.',
        explanation:
          'There are not enough recorded buyer preferences for this property type to make a recommendation yet.',
      };
    case 'no_records':
      return {
        recommendedAction: 'No recommendation available.',
        explanation:
          'There are no recorded buyer preferences or available listings for this property type.',
      };
    case 'insufficient_data':
      return {
        recommendedAction: 'Not enough data to compare buyer interest and supply.',
        explanation:
          'Portfolio-wide buyer preferences or available listings are empty, so no comparison can be made.',
      };
  }
}

export const TypeDecisionDrilldownModal: React.FC<TypeDecisionDrilldownModalProps> = ({
  decision,
  onClose,
  buyers,
  buyersLoading,
  buyersError,
  onRetryBuyers,
  properties,
  propertiesLoading,
  propertiesError,
  onRetryProperties,
  rankings,
  onNavigate,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [expandedState, setExpandedState] = useState<{
    type: string | null;
    buyers: boolean;
    supply: boolean;
  }>({ type: null, buyers: false, supply: false });
  const isOpen = decision !== null;

  const handleClose = useCallback(() => {
    setExpandedState({ type: null, buyers: false, supply: false });
    onClose();
  }, [onClose]);

  const modalRef = useModalAccessibility({
    isOpen,
    onClose: handleClose,
    initialFocusRef: closeButtonRef,
  });

  const rankingsByPropertyId = useMemo(() => {
    const map = new Map<string, PropertyRanking>();
    for (const entry of rankings) {
      map.set(entry.propertyId, entry);
    }
    return map;
  }, [rankings]);

  const matchingBuyers = useMemo(() => {
    if (!decision || !buyers) return [];
    return buyers.filter((b) => b.preferences?.landType === decision.type);
  }, [buyers, decision]);

  const matchingSupply = useMemo(() => {
    if (!decision || !properties) return [];
    // Matches backend analyticsService.js: Available listings with finite price > 0 of this type
    return properties.filter(
      (p) =>
        p.status === 'Available' &&
        p.type === decision.type &&
        typeof p.price === 'number' &&
        Number.isFinite(p.price) &&
        p.price > 0
    );
  }, [decision, properties]);

  if (!decision) return null;

  const badge = DECISION_BADGE[decision.decision];
  const guidance = buildPlainLanguageGuidance(decision);
  const isBuyerDemandOpen = expandedState.type === decision.type && expandedState.buyers;
  const isSupplyOpen = expandedState.type === decision.type && expandedState.supply;

  const toggleBuyerDemand = () => {
    setExpandedState((prev) => ({
      type: decision.type,
      buyers: prev.type === decision.type ? !prev.buyers : true,
      supply: prev.type === decision.type ? prev.supply : false,
    }));
  };

  const toggleSupply = () => {
    setExpandedState((prev) => ({
      type: decision.type,
      buyers: prev.type === decision.type ? prev.buyers : false,
      supply: prev.type === decision.type ? !prev.supply : true,
    }));
  };

  return (
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center p-4"
      aria-hidden={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="type-decision-drilldown-title"
        tabIndex={-1}
        className="admin-panel relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden focus:outline-none"
        style={{ boxShadow: '0 12px 36px rgba(15, 23, 42, 0.22)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-[#d6c7b2]">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0"
              aria-hidden="true"
            >
              <Target className="w-4 h-4" />
            </span>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2
                id="type-decision-drilldown-title"
                className="text-[#2f2417] font-semibold text-base leading-snug"
              >
                {decision.type}
              </h2>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close property type decision details"
            className="p-1.5 rounded-lg text-[#7c6a57] hover:text-[#2f2417] hover:bg-white/60 bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Recommended Action + Plain-Language Explanation */}
          <div className={`rounded-xl border p-4 space-y-1.5 ${badge.panelAccent}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#5d503f]">
              Recommended Action
            </p>
            <p className="text-base font-semibold text-[#2f2417] leading-snug">
              {guidance.recommendedAction}
            </p>
            <p className="text-sm text-[#5d503f] leading-relaxed">{guidance.explanation}</p>
          </div>

          {/* Portfolio Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/60 border border-[#e8e0d5] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#7c6a57]">Interested Buyers</p>
                <p className="text-2xl font-bold text-[#2f2417] mt-1">{decision.buyers}</p>
              </div>
              <span className="p-2.5 rounded-xl bg-emerald-50/70 text-emerald-700" aria-hidden="true">
                <Users className="w-5 h-5" />
              </span>
            </div>
            <div className="rounded-xl bg-white/60 border border-[#e8e0d5] p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-[#7c6a57]">Available Properties</p>
                <p className="text-2xl font-bold text-[#2f2417] mt-1">{decision.listings}</p>
              </div>
              <span className="p-2.5 rounded-xl bg-emerald-50/70 text-emerald-700" aria-hidden="true">
                <Home className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Document Readiness */}
          <div className="rounded-xl bg-white/50 border border-[#e8e0d5] p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#2f2417]">
              Document Readiness
            </h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-white/70 border border-[#e8e0d5] p-2.5">
                <dt className="text-[#5d503f]">Ready for Presentation</dt>
                <dd className="text-lg font-bold text-emerald-700 mt-0.5">
                  {decision.readiness.low}
                </dd>
              </div>
              <div className="rounded-lg bg-white/70 border border-[#e8e0d5] p-2.5">
                <dt className="text-[#5d503f]">Needs Document Review</dt>
                <dd className="text-lg font-bold text-amber-700 mt-0.5">
                  {decision.readiness.medium}
                </dd>
              </div>
              <div className="rounded-lg bg-white/70 border border-[#e8e0d5] p-2.5">
                <dt className="text-[#5d503f]">High Risk</dt>
                <dd className="text-lg font-bold text-rose-700 mt-0.5">
                  {decision.readiness.high}
                </dd>
              </div>
              <div className="rounded-lg bg-white/70 border border-[#e8e0d5] p-2.5">
                <dt className="text-[#5d503f]">Not Yet Assessed</dt>
                <dd className="text-lg font-bold text-[#2f2417] mt-0.5">
                  {decision.readiness.notAudited}
                </dd>
              </div>
            </dl>
            <p className="text-[11px] text-[#7c6a57]">
              Readiness reflects the system&apos;s administrative document-verification status, not
              legal validation.
            </p>
          </div>

          {/* Buyer Demand (independently collapsible, collapsed by default) */}
          <section
            className="rounded-xl border border-[#d6c7b2] bg-white/40 overflow-hidden"
            aria-labelledby="type-decision-buyer-demand-heading"
          >
            <button
              id="type-decision-buyer-demand-heading"
              type="button"
              aria-expanded={isBuyerDemandOpen}
              aria-controls="type-decision-buyer-demand-panel"
              onClick={toggleBuyerDemand}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#2f2417] hover:bg-white/60 transition-colors bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600"
            >
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Buyer Demand ({buyersLoading ? '…' : matchingBuyers.length})
              </span>
              {isBuyerDemandOpen ? (
                <ChevronUp className="w-4 h-4 text-[#7c6a57]" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#7c6a57]" aria-hidden="true" />
              )}
            </button>

            {isBuyerDemandOpen && (
              <div
                id="type-decision-buyer-demand-panel"
                className="px-4 pb-4 pt-3 border-t border-[#e8e0d5] space-y-2.5"
              >
                {!buyersLoading && !buyersError && matchingBuyers.length !== decision.buyers && (
                  <p className="text-[11px] text-[#7c6a57]">Card count: {decision.buyers}</p>
                )}

                {buyersLoading ? (
                  <div className="py-5 flex items-center justify-center gap-2 text-xs text-[#7c6a57]">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Loading buyer records…</span>
                  </div>
                ) : buyersError ? (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/50 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{buyersError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onRetryBuyers}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                ) : matchingBuyers.length === 0 ? (
                  <p className="text-xs text-[#7c6a57] py-2">
                    No buyers currently list {decision.type} as their preferred property type.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#e8e0d5] bg-white/60">
                    <table className="admin-table w-full text-xs">
                      <thead>
                        <tr className="text-left text-[#7c6a57] uppercase tracking-wider border-b border-[#d6c7b2]">
                          <th className="py-2 px-3 font-semibold">Buyer</th>
                          <th className="py-2 px-3 font-semibold">Budget Range</th>
                          <th className="py-2 px-3 font-semibold">Preferred Location</th>
                          <th className="py-2 px-3 font-semibold">Intended Use</th>
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
                                idx % 2 === 0 ? 'bg-white/40' : ''
                              }`}
                            >
                              <td className="py-2 px-3">
                                <p className="font-medium text-[#2f2417]">{display.primary}</p>
                                {display.secondary && (
                                  <p className="text-[10px] text-[#7c6a57]">{display.secondary}</p>
                                )}
                              </td>
                              <td className="py-2 px-3 text-[#5d503f]">
                                {formatBudgetRange(pref?.budgetMin, pref?.budgetMax)}
                              </td>
                              <td className="py-2 px-3 text-[#5d503f]">
                                {pref?.location || 'Not specified'}
                              </td>
                              <td className="py-2 px-3 text-[#5d503f]">
                                {pref?.intendedUse || 'Not specified'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Available Property Supply (independently collapsible, collapsed by default) */}
          <section
            className="rounded-xl border border-[#d6c7b2] bg-white/40 overflow-hidden"
            aria-labelledby="type-decision-supply-heading"
          >
            <button
              id="type-decision-supply-heading"
              type="button"
              aria-expanded={isSupplyOpen}
              aria-controls="type-decision-supply-panel"
              onClick={toggleSupply}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#2f2417] hover:bg-white/60 transition-colors bg-transparent border-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-600"
            >
              <span className="flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                Available Property Supply ({propertiesLoading ? '…' : matchingSupply.length})
              </span>
              {isSupplyOpen ? (
                <ChevronUp className="w-4 h-4 text-[#7c6a57]" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#7c6a57]" aria-hidden="true" />
              )}
            </button>

            {isSupplyOpen && (
              <div
                id="type-decision-supply-panel"
                className="px-4 pb-4 pt-3 border-t border-[#e8e0d5] space-y-2.5"
              >
                {!propertiesLoading &&
                  !propertiesError &&
                  matchingSupply.length !== decision.listings && (
                    <p className="text-[11px] text-[#7c6a57]">Card count: {decision.listings}</p>
                  )}

                {propertiesLoading ? (
                  <div className="py-5 flex items-center justify-center gap-2 text-xs text-[#7c6a57]">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>Loading available listings…</span>
                  </div>
                ) : propertiesError ? (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/50 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{propertiesError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={onRetryProperties}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  </div>
                ) : matchingSupply.length === 0 ? (
                  <p className="text-xs text-[#7c6a57] py-2">
                    No Available priced listings of type {decision.type} are currently in the
                    portfolio.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#e8e0d5] bg-white/60">
                    <table className="admin-table w-full text-xs">
                      <thead>
                        <tr className="text-left text-[#7c6a57] uppercase tracking-wider border-b border-[#d6c7b2]">
                          <th className="py-2 px-3 font-semibold">Property</th>
                          <th className="py-2 px-3 font-semibold">Location</th>
                          <th className="py-2 px-3 font-semibold">Asking Price</th>
                          <th className="py-2 px-3 font-semibold">Readiness</th>
                          {onNavigate && (
                            <th className="py-2 px-3 font-semibold text-right">Action</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {matchingSupply.map((property, idx) => {
                          const ranking = rankingsByPropertyId.get(property.id);
                          return (
                            <tr
                              key={property.id}
                              className={`border-b border-[#e8e0d5] last:border-none ${
                                idx % 2 === 0 ? 'bg-white/40' : ''
                              }`}
                            >
                              <td className="py-2 px-3 font-medium text-[#2f2417]">
                                {property.name || 'Unnamed listing'}
                              </td>
                              <td className="py-2 px-3 text-[#5d503f]">
                                {property.location || 'Not specified'}
                              </td>
                              <td className="py-2 px-3 font-medium text-[#2f2417]">
                                {formatPeso(property.price)}
                              </td>
                              <td className="py-2 px-3">
                                {ranking ? (
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      ranking.riskLevel === 'Low'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : ranking.riskLevel === 'Medium'
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {formatReadinessLabel(ranking.riskLevel)} (
                                    {ranking.complianceScore}%)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                                    Not Yet Assessed
                                  </span>
                                )}
                              </td>
                              {onNavigate && (
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleClose();
                                      onNavigate({
                                        page: 'properties',
                                        propertyId: property.id,
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#5d503f] bg-white border border-[#d6c7b2] hover:bg-[#f7f4ed] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                  >
                                    Edit property
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#d6c7b2] flex flex-wrap items-center justify-between gap-2 bg-white/30">
          <div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onNavigate({
                    page: 'properties',
                    propertyType: decision.type,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open {decision.type} listings in Properties
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#2f2417] bg-white border border-[#d6c7b2] hover:bg-[#f7f4ed] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
