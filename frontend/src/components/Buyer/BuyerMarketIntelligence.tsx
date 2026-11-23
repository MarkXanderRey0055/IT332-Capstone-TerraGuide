import React, { useEffect, useState } from 'react';
import { TrendingUp, AlertCircle } from 'lucide-react';
import { getBuyerSearchMetrics, type BuyerSearchMetrics } from '../../services/AnalyticsService';
import { ApiError } from '../../utils/api';
import { COLORS } from '../../styles/buyerTheme';

export const BuyerMarketIntelligence: React.FC = () => {
  const [searchMetrics, setSearchMetrics] = useState<BuyerSearchMetrics | null>(null);
  const [isLoadingSearchMetrics, setIsLoadingSearchMetrics] = useState(true);
  const [searchMetricsError, setSearchMetricsError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getBuyerSearchMetrics()
      .then((result) => {
        if (!cancelled) setSearchMetrics(result);
      })
      .catch((err) => {
        if (!cancelled) setSearchMetricsError(err instanceof ApiError ? err.message : 'Could not load recorded search metrics.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSearchMetrics(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="max-w-[1500px] mx-auto px-4 sm:px-8 pb-16 sm:pb-24">
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[rgba(40,90,72,0.2)]">
        <TrendingUp className="w-5 h-5 text-[#285A48]" />
        <div>
          <h2 className="font-serif text-2xl font-normal text-[#1A2D24]">Market Intelligence</h2>
          <p className="text-xs text-[#5C7A6E] mt-0.5">
            Based on buyer searches from the last 30 days.
          </p>
        </div>
      </div>
      <div className="w-full">
        <div
          className="w-full rounded-xl p-5 shadow-md border min-h-[180px]"
          style={{ background: COLORS.surface, borderColor: 'rgba(40,90,72,0.15)' }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
              Search activity (last 30 days)
            </h3>
            <p className="text-xs font-medium" style={{ color: COLORS.textSecondary }}>
              {searchMetrics
                ? `${searchMetrics.totalSearches} recorded searches since ${new Date(searchMetrics.windowStart).toLocaleDateString()}.`
                : 'Recorded searches in the last 30 days.'}
            </p>
          </div>
          {searchMetricsError && <MiniError message={searchMetricsError} />}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SearchMetricSection
              title="Most searched property types"
              group={searchMetrics?.propertyTypes}
              labelKey="type"
              isLoading={isLoadingSearchMetrics}
              hasError={Boolean(searchMetricsError)}
              ranked
            />
            <SearchMetricSection
              title="Popular locations"
              group={searchMetrics?.popularLocations}
              labelKey="location"
              isLoading={isLoadingSearchMetrics}
              hasError={Boolean(searchMetricsError)}
              ranked
            />
            <SearchMetricSection
              title="Trending price ranges"
              group={searchMetrics?.priceRanges}
              labelKey="range"
              isLoading={isLoadingSearchMetrics}
              hasError={Boolean(searchMetricsError)}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

const SearchMetricSection: React.FC<{
  title: string;
  group?: BuyerSearchMetrics['propertyTypes'];
  labelKey: 'type' | 'location' | 'range';
  isLoading: boolean;
  hasError: boolean;
  ranked?: boolean;
}> = ({ title, group, labelKey, isLoading, hasError, ranked = false }) => {
  const items = group?.items ?? [];
  const displayItems = ranked
    ? [...items].sort((left, right) => right.count - left.count || String(left[labelKey] ?? '').localeCompare(String(right[labelKey] ?? '')))
    : items;

  return (
    <section className="rounded-lg border border-[rgba(40,90,72,0.18)] px-3 py-2.5 min-h-[116px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 mb-2">
        <h4 className="text-xs font-semibold" style={{ color: COLORS.textSecondary }}>{title}</h4>
        {!isLoading && !hasError && group && !group.enoughSearches && (
          <p className="text-xs" style={{ color: COLORS.textHint }}>Not enough searches yet.</p>
        )}
        {!isLoading && !hasError && group?.smallSample && (
          <p className="text-xs" style={{ color: COLORS.textSecondary }}>
            Based on {group.eligibleSearches} searches, small sample.
          </p>
        )}
        {isLoading && <p className="text-xs" style={{ color: COLORS.textHint }}>Loading…</p>}
      </div>
      {!isLoading && !hasError && group?.enoughSearches && (
        <div className="space-y-1.5">
          {displayItems.length === 0 && <p className="text-xs" style={{ color: COLORS.textHint }}>No matching searches in this period.</p>}
          {displayItems.map((item) => (
            <div key={item[labelKey] ?? 'unknown'} className="flex justify-between gap-2 text-[11px]">
              <span className="truncate font-semibold" style={{ color: item.count === 0 ? COLORS.textHint : COLORS.textSecondary }}>
                {item[labelKey] ?? 'Other'}: {item.count} searches.
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

const MiniError: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-start gap-1.5 text-[11px]" style={{ color: COLORS.error }}>
    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
    <span>{message}</span>
  </div>
);

export default BuyerMarketIntelligence;
