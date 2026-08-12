import React, { useEffect, useState } from 'react';
import { TrendingUp, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import type { Property } from '../../types/types';
import {
  getBuyerMarketTrends,
  generateBuyerMarketInsight,
  type BuyerMarketTrends,
  type BuyerMarketInsightResult,
} from '../../services/AnalyticsService';
import { ApiError } from '../../utils/api';
import { COLORS } from '../../styles/buyerTheme';

interface BuyerMarketIntelligenceProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

// Pill variants map to semantic meaning — green for positive signals,
// blue for neutral metrics, amber for missing/limited data, neutral for names/places.
type PillVariant = 'green' | 'blue' | 'amber' | 'neutral';

const PILL_STYLES: Record<PillVariant, React.CSSProperties> = {
  green: {
    background: 'rgba(176,228,204,0.18)',
    color: '#B0E4CC',
    border: '1px solid rgba(176,228,204,0.3)',
  },
  blue: {
    background: 'rgba(160,196,228,0.18)',
    color: '#A0C4E4',
    border: '1px solid rgba(160,196,228,0.3)',
  },
  amber: {
    background: 'rgba(228,199,160,0.18)',
    color: '#E4C7A0',
    border: '1px solid rgba(228,199,160,0.3)',
  },
  neutral: {
    background: 'rgba(255,255,255,0.07)',
    color: '#E8F5EF',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

// Wraps a value in an inline pill badge.
const Pill: React.FC<{ children: React.ReactNode; variant: PillVariant }> = ({
  children,
  variant,
}) => (
  <span
    style={{
      ...PILL_STYLES[variant],
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 7px',
      borderRadius: '999px',
      fontSize: '10px',
      fontWeight: 600,
      lineHeight: '18px',
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
      margin: '0 2px',
    }}
  >
    {children}
  </span>
);

// Replaces known variable strings from the snapshot inside an AI sentence
// with highlighted pills — this keeps all styling in the frontend while
// the backend stays clean text-only.
function highlightSentence(
  text: string,
  highlights: Array<{ value: string; variant: PillVariant }>
): React.ReactNode {
  // Build a regex that matches any of the highlight values (longest first
  // to avoid partial matches eating a longer target).
  const sorted = [...highlights]
    .filter((h) => h.value && h.value.trim().length > 0)
    .sort((a, b) => b.value.length - a.value.length);

  if (sorted.length === 0) return text;

  const pattern = sorted.map((h) => h.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const match = sorted.find((h) => h.value.toLowerCase() === part.toLowerCase());
    if (match) {
      return (
        <Pill key={i} variant={match.variant}>
          {part}
        </Pill>
      );
    }
    return part;
  });
}

export const BuyerMarketIntelligence: React.FC<BuyerMarketIntelligenceProps> = ({
  properties,
  onSelectProperty,
}) => {
  const [trends, setTrends] = useState<BuyerMarketTrends | null>(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);
  const [trendsError, setTrendsError] = useState('');

  const [insightResult, setInsightResult] = useState<BuyerMarketInsightResult | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTrends = async () => {
      setIsLoadingTrends(true);
      setTrendsError('');
      try {
        const result = await getBuyerMarketTrends(5);
        if (!cancelled) setTrends(result);
      } catch (err) {
        if (!cancelled) {
          setTrendsError(
            err instanceof ApiError
              ? err.message
              : 'Could not load market trends right now.'
          );
        }
      } finally {
        if (!cancelled) setIsLoadingTrends(false);
      }
    };
    loadTrends();
    return () => { cancelled = true; };
  }, []);

  const handleGenerateInsight = async () => {
    setIsGeneratingInsight(true);
    setInsightError('');
    try {
      const result = await generateBuyerMarketInsight();
      setInsightResult(result);
    } catch (err) {
      if (err instanceof ApiError && (err.details?.error === 'AI_DAILY_LIMIT_REACHED' || err.details?.error === 'AI_RATE_LIMIT_REACHED')) {
        // Buyers don't need to know this is a shared daily quota or an
        // RPM window — just that the feature isn't available right now.
        setInsightError(
          'AI Market Insight is temporarily unavailable because the AI service has reached its current usage limit. Please try again later.'
        );
      } else {
        setInsightError(
          err instanceof ApiError
            ? err.message
            : 'Could not generate a market insight right now. Please try again.'
        );
      }
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleListingClick = (propertyId: string) => {
    const property = properties.find((p) => p.id === propertyId);
    if (property) onSelectProperty(property);
  };

  // Build the highlight map from the snapshot so we never fabricate values.
  const buildHighlights = (
    result: BuyerMarketInsightResult
  ): Array<{ value: string; variant: PillVariant }> => {
    const s = result.snapshot;
    const h: Array<{ value: string; variant: PillVariant }> = [];

    // Property types — green (positive/demand signal)
    s.trendingTypes?.forEach((t) => {
      h.push({ value: t.type, variant: 'green' });
      h.push({ value: `${t.percentage}%`, variant: 'green' });
    });

    // Listing names — neutral
    s.topListings?.forEach((l) => {
      h.push({ value: l.name, variant: 'neutral' });
      // Market scores — blue (metric)
      h.push({ value: String(l.marketScore), variant: 'blue' });
    });

    // Numeric listing counts — blue
    if (s.totalProperties > 0) h.push({ value: String(s.totalProperties), variant: 'blue' });
    if (s.availableProperties > 0) h.push({ value: String(s.availableProperties), variant: 'blue' });
    if (s.totalBuyersWithPreferences > 0) h.push({ value: String(s.totalBuyersWithPreferences), variant: 'blue' });

    // Location — neutral
    if (s.topPreferredLocation) h.push({ value: s.topPreferredLocation, variant: 'neutral' });

    // Budget/unavailable markers — amber (caution / missing data signal)
    if (s.averageBudget && s.averageBudget > 0) {
      h.push({ value: `₱${s.averageBudget.toLocaleString()}`, variant: 'blue' });
    } else {
      h.push({ value: 'currently unavailable', variant: 'amber' });
      h.push({ value: 'unavailable', variant: 'amber' });
      h.push({ value: 'not recorded', variant: 'amber' });
      h.push({ value: 'no data recorded yet', variant: 'amber' });
    }

    return h;
  };

  const insight = insightResult?.insight ?? null;
  const highlights = insightResult ? buildHighlights(insightResult) : [];

  return (
    <section className="max-w-[1500px] mx-auto px-4 sm:px-8 pb-16 sm:pb-24">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[rgba(40,90,72,0.2)]">
        <TrendingUp className="w-5 h-5 text-[#285A48]" />
        <div>
          <h2 className="font-serif text-2xl font-normal text-[#1A2D24]">Market Intelligence</h2>
          <p className="text-xs text-[#5C7A6E] mt-0.5">
            A quick read on buyer demand and listing activity to help you decide.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 1. Trending Property Types */}
        <div
          className="rounded-xl p-5 shadow-md border"
          style={{ background: COLORS.surface, borderColor: 'rgba(40,90,72,0.15)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
            Trending Property Types
          </h3>

          {isLoadingTrends && (
            <div className="space-y-3 animate-pulse">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-2.5 rounded-full bg-[rgba(176,228,204,0.1)]" />
              ))}
            </div>
          )}

          {!isLoadingTrends && trendsError && <MiniError message={trendsError} />}

          {!isLoadingTrends && !trendsError && trends && trends.trendingTypes.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.textHint }}>
              No buyer preference data yet. Trends will appear once buyers set their preferences.
            </p>
          )}

          {!isLoadingTrends && !trendsError && trends && trends.trendingTypes.length > 0 && (
            <div className="space-y-3">
              {trends.trendingTypes.map((item) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>
                      {item.type}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: COLORS.textHint }}>
                      {item.percentage}%
                    </span>
                  </div>
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ background: 'rgba(40,90,72,0.15)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.percentage}%`, background: COLORS.primaryLight }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Top Market Listings */}
        <div
          className="rounded-xl p-5 shadow-md border"
          style={{ background: COLORS.surface, borderColor: 'rgba(40,90,72,0.15)' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
            Top Market Listings
          </h3>

          {isLoadingTrends && (
            <div className="space-y-2 animate-pulse">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 rounded-lg bg-[rgba(176,228,204,0.1)]" />
              ))}
            </div>
          )}

          {!isLoadingTrends && trendsError && <MiniError message={trendsError} />}

          {!isLoadingTrends && !trendsError && trends && trends.topListings.length === 0 && (
            <p className="text-xs" style={{ color: COLORS.textHint }}>
              No ranked listings yet. Check back once properties have been reviewed.
            </p>
          )}

          {!isLoadingTrends && !trendsError && trends && trends.topListings.length > 0 && (
            <ul className="space-y-1.5">
              {trends.topListings.map((listing) => (
                <li key={listing.propertyId}>
                  <button
                    type="button"
                    onClick={() => handleListingClick(listing.propertyId)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors cursor-pointer border border-transparent hover:border-[rgba(40,90,72,0.3)]"
                    style={{ background: COLORS.surfaceVariant }}
                  >
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: COLORS.primaryLight, color: COLORS.textPrimary }}
                    >
                      {listing.rank}
                    </span>
                    <span
                      className="flex-1 min-w-0 text-xs font-medium truncate"
                      style={{ color: COLORS.textSecondary }}
                      title={listing.name}
                    >
                      {listing.name}
                    </span>
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'rgba(176,228,204,0.15)',
                        color: COLORS.textHint,
                        border: '1px solid rgba(176,228,204,0.25)',
                      }}
                    >
                      {listing.marketScore}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. AI Market Insight */}
        <div
          className="rounded-xl p-5 shadow-md border flex flex-col"
          style={{ background: COLORS.surface, borderColor: 'rgba(40,90,72,0.15)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4" style={{ color: COLORS.textHint }} />
            <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
              AI Market Insight
            </h3>
          </div>

          {/* Pre-generate state */}
          {!insight && !isGeneratingInsight && (
            <div className="flex-1 flex flex-col items-start justify-center gap-3">
              <p className="text-xs" style={{ color: COLORS.textHint }}>
                Get a quick, AI-generated read on current buyer interest and market activity.
              </p>
              <button
                type="button"
                onClick={handleGenerateInsight}
                className="text-xs font-semibold px-4 py-2 rounded-lg transition-all cursor-pointer"
                style={{ background: COLORS.primaryLight, color: COLORS.textPrimary }}
              >
                Generate Market Insight
              </button>
              {insightError && <MiniError message={insightError} />}
            </div>
          )}

          {/* Loading state */}
          {isGeneratingInsight && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-4">
              <RefreshCw className="w-4 h-4 animate-spin" style={{ color: COLORS.textHint }} />
              <p className="text-[11px]" style={{ color: COLORS.textHint }}>
                Analyzing current market data...
              </p>
            </div>
          )}

          {/* Structured insight display */}
          {insight && !isGeneratingInsight && (
            <div className="flex-1 flex flex-col gap-3">
              <InsightSection
                label="Buyer Demand"
                text={insight.buyerDemand}
                highlights={highlights}
              />
              <InsightSection
                label="Top Market Listings"
                text={insight.topListings}
                highlights={highlights}
              />
              <InsightSection
                label="Market Context"
                text={insight.marketContext}
                highlights={highlights}
              />

              <button
                type="button"
                onClick={handleGenerateInsight}
                className="self-start text-[11px] font-medium flex items-center gap-1 cursor-pointer bg-transparent border-none mt-1"
                style={{ color: COLORS.textHint }}
              >
                <RefreshCw className="w-3 h-3" />
                Refresh insight
              </button>
              {insightError && <MiniError message={insightError} />}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// Renders one labeled insight section with inline pill highlights.
const InsightSection: React.FC<{
  label: string;
  text: string;
  highlights: Array<{ value: string; variant: PillVariant }>;
}> = ({ label, text, highlights }) => (
  <div>
    <p
      className="text-[10px] font-semibold uppercase tracking-wider mb-1"
      style={{ color: COLORS.textHint, letterSpacing: '0.08em' }}
    >
      {label}
    </p>
    <p className="text-[11px] leading-relaxed" style={{ color: COLORS.textSecondary }}>
      {highlightSentence(text, highlights)}
    </p>
  </div>
);

const MiniError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-1.5 text-[11px]" style={{ color: COLORS.error }}>
    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
    <span>{message}</span>
  </div>
);

export default BuyerMarketIntelligence;