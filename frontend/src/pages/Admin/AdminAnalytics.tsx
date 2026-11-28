import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  type ActiveElement,
  type ChartEvent,
  type Plugin,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Home,
  Users,
  ShieldCheck,
  TrendingUp,
  Wallet,
  AlertTriangle,
  Trophy,
  Sparkles,
  DollarSign,
  Target,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Award,
  MapPin,
} from 'lucide-react';
import {
  getDashboardSummary,
  getChartData,
  getPropertyRankings,
  getBuyerIntelligence,
  getSalesPerformance,
  getTypeDecisions,
  generatePortfolioInsights,
  type DashboardSummary,
  type ChartData as AnalyticsChartData,
  type PropertyRankingsResult,
  type BuyerIntelligence,
  type SalesPerformance,
  type TypeDecision,
  type TypeDecisionsResponse,
  type PortfolioInsightsResult,
  type RiskLevel,
} from '../../services/AnalyticsService';
import {
  exportDataset,
  type ExportDataset,
  type ExportFormat,
} from '../../services/ExportService';
import { getBuyers, type AdminBuyerProfile } from '../../services/AdminBuyerService';
import { getTransactions, type Transaction } from '../../services/TransactionService';
import { getProperties } from '../../services/PropertyService';
import type { Property } from '../../types/types';
import {
  AnalyticsDrilldownModal,
  type AnalyticsDrilldownSelection,
} from '../../components/Admin/AnalyticsDrilldownModal';
import { TypeDecisionDrilldownModal } from '../../components/Admin/TypeDecisionDrilldownModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

export type AdminAnalyticsNavigateTarget =
  | { page: 'activities'; tab: 'inquiries' | 'sitevisits'; recordId: string }
  | { page: 'properties'; propertyId?: string; propertyType?: string };

interface AdminAnalyticsProps {
  onToast?: (message: string) => void;
  onNavigate?: (target: AdminAnalyticsNavigateTarget) => void;
}

const AXIS_COLOR = 'rgba(94, 79, 60, 0.8)';
const GRID_COLOR = 'rgba(166, 145, 112, 0.18)';
const LEGEND_COLOR = 'rgba(86, 72, 54, 0.88)';

const TOOLTIP_STYLE = {
  backgroundColor: '#F7F4ED',
  titleColor: '#2f2417',
  bodyColor: '#5d503f',
  borderColor: 'rgba(120,102,78,0.18)',
  borderWidth: 1,
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
  scales: {
    x: { ticks: { color: AXIS_COLOR, font: { size: 11 } }, grid: { color: GRID_COLOR } },
    y: {
      ticks: { color: AXIS_COLOR, font: { size: 11 }, precision: 0 },
      grid: { color: GRID_COLOR },
    },
  },
};

const horizontalBarOptions = {
  ...barOptions,
  indexAxis: 'y' as const,
};

const preferredLocationsOptions = {
  ...horizontalBarOptions,
  layout: { padding: { right: 18 } },
  scales: {
    ...horizontalBarOptions.scales,
    x: { ...horizontalBarOptions.scales.x, grace: '20%' },
  },
};

const preferredLocationsValueLabels: Plugin<'bar'> = {
  id: 'preferred-locations-value-labels',
  afterDatasetsDraw: (chart) => {
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !chart.isDatasetVisible(0)) return;

    const context = chart.ctx;
    context.save();
    context.font = '600 11px sans-serif';
    context.fillStyle = LEGEND_COLOR;
    context.textAlign = 'left';
    context.textBaseline = 'middle';

    meta.data.forEach((element, index) => {
      if (!chart.getDataVisibility(index)) return;
      const value = Number(dataset.data[index] ?? 0);
      const { x, y, width } = (element as BarElement).getProps(['x', 'y', 'width'], true);
      if (x === null || y === null || width === null) return;
      context.fillText(String(value), x + width / 2 + 6, y);
    });

    context.restore();
  },
};

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
  scales: {
    x: { ticks: { color: AXIS_COLOR, font: { size: 11 } }, grid: { color: GRID_COLOR } },
    y: {
      ticks: { color: AXIS_COLOR, font: { size: 11 }, precision: 0 },
      grid: { color: GRID_COLOR },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: LEGEND_COLOR, font: { size: 11 }, padding: 14 },
    },
    tooltip: TOOLTIP_STYLE,
  },
};

const preferredTypesSliceLabels: Plugin<'doughnut'> = {
  id: 'preferred-types-slice-labels',
  afterDatasetsDraw: (chart) => {
    if (!chart.isDatasetVisible(0)) return;

    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta.data.length) return;

    const visibleTotal = dataset.data.reduce((total, value, index) => {
      return chart.getDataVisibility(index) ? total + Number(value ?? 0) : total;
    }, 0);
    if (visibleTotal <= 0) return;

    const context = chart.ctx;
    context.save();
    context.font = '600 11px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(34, 49, 39, 0.9)';
    context.fillStyle = '#ffffff';

    meta.data.forEach((element, index) => {
      const value = Number(dataset.data[index] ?? 0);
      if (!chart.getDataVisibility(index) || value <= 0) return;

      const arc = element as ArcElement;
      const { x, y, startAngle, endAngle, innerRadius, outerRadius } = arc.getProps(
        ['x', 'y', 'startAngle', 'endAngle', 'innerRadius', 'outerRadius'],
        true
      );
      if (x === null || y === null) return;
      const midpointAngle = (startAngle + endAngle) / 2;
      const midpointRadius = (innerRadius + outerRadius) / 2;
      const labelX = x + Math.cos(midpointAngle) * midpointRadius;
      const labelY = y + Math.sin(midpointAngle) * midpointRadius;
      const percentage = Math.round((value / visibleTotal) * 100);
      const label = `${percentage}%`;

      context.strokeText(label, labelX, labelY);
      context.fillText(label, labelX, labelY);
    });

    context.restore();
  },
};

const TYPE_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: 'bg-emerald-500/15 text-emerald-600',
  Medium: 'bg-amber-500/15 text-amber-600',
  High: 'bg-rose-500/15 text-rose-600',
};

const formatCurrency = (amount: number | null | undefined) => {
  const value = Number(amount ?? 0);
  return `₱${value.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

const formatMonth = (yyyyMm: string) => {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
};

const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => (
  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${RISK_STYLES[level]}`}>
    {level}
  </span>
);

const SectionHeader: React.FC<{
  icon: React.ElementType;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 rounded-lg bg-emerald-100/50">
        <Icon className="w-4 h-4 text-emerald-700" />
      </div>
      <div>
        <h3 className="text-[#2f2417] font-semibold text-sm">{title}</h3>
        <p className="text-[#7c6a57] text-xs">— {subtitle}</p>
      </div>
    </div>
    {action && <div className="flex items-center gap-2">{action}</div>}
  </div>
);

const EmptyState: React.FC<{ message: string; icon?: React.ElementType }> = ({
  message,
  icon: Icon,
}) => (
  <div className="h-full flex flex-col items-center justify-center py-10">
    {Icon && <Icon className="w-10 h-10 text-[#9d8c76] mb-3 opacity-30" strokeWidth={1.5} />}
    <p className="text-[#7c6a57] text-xs text-center max-w-sm">{message}</p>
  </div>
);

const MetricTooltip: React.FC<{ tooltip: string }> = ({ tooltip }) => (
  <div className="relative inline-flex items-center group">
    <Info className="w-3.5 h-3.5 text-[#9d8c76] cursor-help" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-[#2f2417] text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
      {tooltip}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2f2417]" />
    </div>
  </div>
);

// Matches backend scoreBuckets in analyticsService.js (getChartData)
const COMPLIANCE_SCORE_BUCKETS: Record<string, { min: number; max: number }> = {
  '0-20%': { min: 0, max: 20 },
  '21-40%': { min: 21, max: 40 },
  '41-60%': { min: 41, max: 60 },
  '61-80%': { min: 61, max: 80 },
  '81-100%': { min: 81, max: 100 },
};

const TYPE_DECISION_BADGES: Record<
  TypeDecision['decision'],
  { label: string; className: string }
> = {
  shortage: {
    label: 'Source or promote',
    className: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  },
  surplus: {
    label: 'Hold',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
  },
  insufficient_sample: {
    label: 'Insufficient sample',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
  within_range: {
    label: 'Within range',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
  no_records: {
    label: 'No records',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
  insufficient_data: {
    label: 'Not enough data',
    className: 'bg-gray-100 text-gray-700 border border-gray-200',
  },
};

// PROVISIONAL: pending Smart Works confirmation (matches MIN_BUYERS_FOR_DECISION).
const PROVISIONAL_MIN_BUYERS_FOR_DECISION = 5;

function formatTypeDecisionText(item: TypeDecision): string {
  switch (item.decision) {
    case 'shortage':
      if (item.blockingCount > 0) {
        const listingWord = item.blockingCount === 1 ? 'listing' : 'listings';
        return `Complete document checks on ${item.blockingCount} existing ${listingWord} first, then source.`;
      }
      return 'Source or promote.';
    case 'surplus':
      if (item.unauditedCount > 0) {
        const listingWord = item.unauditedCount === 1 ? 'listing' : 'listings';
        return `Audit ${item.unauditedCount} unaudited ${listingWord} before any pricing or promotion decision.`;
      }
      return 'Hold this type.';
    case 'insufficient_sample':
      return `Below the ${PROVISIONAL_MIN_BUYERS_FOR_DECISION} buyer minimum, so no decision is made.`;
    case 'within_range':
      return 'Within range; no action.';
    case 'no_records':
      return 'No records in the current dataset.';
    case 'insufficient_data':
      return 'Not enough records to compute a comparison.';
  }
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ onToast, onNavigate }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<AnalyticsChartData | null>(null);
  const [rankingsResult, setRankingsResult] = useState<PropertyRankingsResult | null>(null);
  const [buyerIntel, setBuyerIntel] = useState<BuyerIntelligence | null>(null);
  const [salesPerf, setSalesPerf] = useState<SalesPerformance | null>(null);
  const [typeDecisions, setTypeDecisions] = useState<TypeDecisionsResponse | null>(null);
  const [decisionsError, setDecisionsError] = useState('');
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [selectedComplianceRange, setSelectedComplianceRange] = useState<string | null>(null);
  const [drilldownSelection, setDrilldownSelection] =
    useState<AnalyticsDrilldownSelection | null>(null);

  const [buyersCache, setBuyersCache] = useState<AdminBuyerProfile[] | null>(null);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [buyersError, setBuyersError] = useState('');
  const buyersInFlightRef = useRef(false);

  const [transactionsCache, setTransactionsCache] = useState<Transaction[] | null>(null);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState('');
  const transactionsInFlightRef = useRef(false);

  const [propertiesCache, setPropertiesCache] = useState<Property[] | null>(null);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [propertiesError, setPropertiesError] = useState('');
  const propertiesInFlightRef = useRef(false);

  const [selectedTypeDecision, setSelectedTypeDecision] = useState<TypeDecision | null>(null);

  const ensureBuyersLoaded = useCallback(
    async (force = false) => {
      if (!force && buyersCache !== null) return;
      if (buyersInFlightRef.current) return;
      buyersInFlightRef.current = true;
      setBuyersLoading(true);
      setBuyersError('');
      try {
        const records = await getBuyers();
        setBuyersCache(records);
      } catch {
        setBuyersError('Could not load buyer preference records. Please try again.');
      } finally {
        buyersInFlightRef.current = false;
        setBuyersLoading(false);
      }
    },
    [buyersCache]
  );

  const ensureTransactionsLoaded = useCallback(
    async (force = false) => {
      if (!force && transactionsCache !== null) return;
      if (transactionsInFlightRef.current) return;
      transactionsInFlightRef.current = true;
      setTransactionsLoading(true);
      setTransactionsError('');
      try {
        const records = await getTransactions({ status: 'Completed' });
        setTransactionsCache(records);
      } catch {
        setTransactionsError('Could not load completed transactions. Please try again.');
      } finally {
        transactionsInFlightRef.current = false;
        setTransactionsLoading(false);
      }
    },
    [transactionsCache]
  );

  const ensurePropertiesLoaded = useCallback(
    async (force = false) => {
      if (!force && propertiesCache !== null) return;
      if (propertiesInFlightRef.current) return;
      propertiesInFlightRef.current = true;
      setPropertiesLoading(true);
      setPropertiesError('');
      try {
        const records = await getProperties({ includeAuth: true });
        setPropertiesCache(records);
      } catch {
        setPropertiesError('Could not load property listings. Please try again.');
      } finally {
        propertiesInFlightRef.current = false;
        setPropertiesLoading(false);
      }
    },
    [propertiesCache]
  );

  const openTypeDecisionDrilldown = useCallback(
    (decision: TypeDecision) => {
      setSelectedTypeDecision(decision);
      void ensureBuyersLoaded();
      void ensurePropertiesLoaded();
    },
    [ensureBuyersLoaded, ensurePropertiesLoaded]
  );

  const openDrilldown = useCallback(
    (selection: AnalyticsDrilldownSelection) => {
      setDrilldownSelection(selection);
      if (selection.kind === 'monthly_revenue') {
        void ensureTransactionsLoaded();
      } else {
        void ensureBuyersLoaded();
      }
    },
    [ensureBuyersLoaded, ensureTransactionsLoaded]
  );

  const toggleComplianceRange = useCallback((label: string) => {
    setSelectedComplianceRange((current) => (current === label ? null : label));
  }, []);

  const complianceDistOptions = useMemo(
    () => ({
      ...barOptions,
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement | null;
        if (target) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0 || !charts) return;
        const bucket = charts.complianceScoreDistribution[elements[0].index];
        if (bucket?.label) {
          toggleComplianceRange(bucket.label);
        }
      },
    }),
    [charts, toggleComplianceRange]
  );

  const salesTrendOptions = useMemo(
    () => ({
      ...lineOptions,
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement | null;
        if (target) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0 || !salesPerf) return;
        const point = salesPerf.monthlyTrend[elements[0].index];
        if (point) {
          openDrilldown({
            kind: 'monthly_revenue',
            key: point.month,
            label: formatMonth(point.month),
            chartRevenue: point.total,
          });
        }
      },
    }),
    [openDrilldown, salesPerf]
  );

  const budgetBarOptions = useMemo(
    () => ({
      ...barOptions,
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement | null;
        if (target) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0 || !buyerIntel) return;
        const bucket = buyerIntel.budgetDistribution[elements[0].index];
        if (bucket) {
          openDrilldown({
            kind: 'budget',
            key: bucket.label,
            label: bucket.label,
            chartCount: bucket.count,
          });
        }
      },
    }),
    [buyerIntel, openDrilldown]
  );

  const preferredTypesDoughnutOptions = useMemo(
    () => ({
      ...doughnutOptions,
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement | null;
        if (target) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0 || !buyerIntel) return;
        const segment = buyerIntel.preferredTypes[elements[0].index];
        if (segment) {
          openDrilldown({
            kind: 'preferred_type',
            key: segment.label,
            label: segment.label,
            chartCount: segment.count,
          });
        }
      },
    }),
    [buyerIntel, openDrilldown]
  );

  const preferredLocationsInteractiveOptions = useMemo(
    () => ({
      ...preferredLocationsOptions,
      onHover: (event: ChartEvent, elements: ActiveElement[]) => {
        const target = event.native?.target as HTMLElement | null;
        if (target) {
          target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
        if (elements.length === 0 || !buyerIntel) return;
        const loc = buyerIntel.preferredLocations[elements[0].index];
        if (loc) {
          openDrilldown({
            kind: 'preferred_location',
            key: loc.label,
            label: loc.label,
            chartCount: loc.count,
          });
        }
      },
    }),
    [buyerIntel, openDrilldown]
  );

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [insightsResult, setInsightsResult] = useState<PortfolioInsightsResult | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [reportFormat, setReportFormat] = useState<ExportFormat>('pdf');

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    performance: true,
    rankings: true,
    buyers: true,
    insights: true,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    let isCancelled = false;

    const loadAnalytics = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const [
          summaryData,
          chartData,
          rankingsData,
          buyerData,
          salesData,
        ] = await Promise.all([
          getDashboardSummary(),
          getChartData(),
          getPropertyRankings(),
          getBuyerIntelligence(),
          getSalesPerformance(),
        ]);

        if (isCancelled) return;
        setSummary(summaryData);
        setCharts(chartData);
        setRankingsResult(rankingsData);
        setBuyerIntel(buyerData);
        setSalesPerf(salesData);
      } catch (error) {
        if (isCancelled) return;
        const message =
          error instanceof Error ? error.message : 'Could not load analytics data.';
        setLoadError(message);
        onToast?.(message);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadAnalytics();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadTypeDecisions = async () => {
      setDecisionsLoading(true);
      setDecisionsError('');
      try {
        const data = await getTypeDecisions();
        if (isCancelled) return;
        setTypeDecisions(data);
      } catch {
        if (isCancelled) return;
        setDecisionsError('Could not load recommended actions. Try again later.');
      } finally {
        if (!isCancelled) setDecisionsLoading(false);
      }
    };

    void loadTypeDecisions();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    setInsightsError('');
    setInsightsResult(null);
    try {
      const result = await generatePortfolioInsights();
      setInsightsResult(result);
    } catch (error) {
      setInsightsError(
        error instanceof Error
          ? error.message
          : 'Could not generate portfolio insights. Please try again.'
      );
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleExportReport = async () => {
    setIsExportingReport(true);
    try {
      await exportDataset('analytics' as ExportDataset, reportFormat);
      onToast?.(`Analytics report downloaded as ${reportFormat.toUpperCase()}.`);
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'Could not export the analytics report.'
      );
    } finally {
      setIsExportingReport(false);
    }
  };

  void LegacyPortfolioNarrative;

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-panel rounded-2xl p-5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-[#d6c7b2] rounded" />
                <div className="w-4 h-4 bg-[#d6c7b2] rounded" />
              </div>
              <div className="h-8 w-32 bg-[#d6c7b2] rounded mt-2" />
            </div>
          ))}
        </div>
        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="admin-panel rounded-2xl p-6 animate-pulse">
              <div className="h-4 w-40 bg-[#d6c7b2] rounded mb-4" />
              <div className="h-[200px] bg-[#d6c7b2]/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="admin-panel rounded-2xl p-16 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        <p className="text-[#2f2417] font-semibold text-lg">Couldn't load analytics</p>
        <p className="text-[#7c6a57] text-sm mt-2 max-w-md mx-auto">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!summary || !charts || !rankingsResult || !buyerIntel || !salesPerf) {
    return null;
  }

  const kpiCards = [
    {
      label: 'Total Portfolio Value',
      value: formatCurrency(summary.estimatedPortfolioValue),
      icon: Wallet,
      tooltip: 'Total estimated value of all properties in the portfolio',
    },
    {
      label: 'Avg. Compliance Score',
      value: `${summary.averageComplianceScore}%`,
      icon: ShieldCheck,
      tooltip: 'Average compliance score across all audited properties',
    },
    {
      label: 'Compliance Pass Rate',
      value: `${summary.averageSuccessRate}%`,
      icon: TrendingUp,
      tooltip: 'Percentage of audited properties that have reached the compliance readiness threshold (≥70%)',
    },
    {
      label: 'High-Risk Listings',
      value: summary.highRiskListingsCount.toLocaleString(),
      icon: AlertTriangle,
      tooltip: 'Properties flagged with high risk that need immediate attention',
    },
  ];

  const complianceDistData = {
    labels: charts.complianceScoreDistribution.map((p) => p.label),
    datasets: [
      {
        data: charts.complianceScoreDistribution.map((p) => p.count),
        backgroundColor: charts.complianceScoreDistribution.map((p) => {
          if (!selectedComplianceRange) return '#60a5fa';
          return p.label === selectedComplianceRange ? '#2563eb' : 'rgba(96, 165, 250, 0.35)';
        }),
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ],
  };

  const selectedComplianceBucket = selectedComplianceRange
    ? COMPLIANCE_SCORE_BUCKETS[selectedComplianceRange] ?? null
    : null;
  const selectedBucketChartCount = selectedComplianceRange
    ? charts.complianceScoreDistribution.find((p) => p.label === selectedComplianceRange)?.count ?? null
    : null;
  const filteredRankings = selectedComplianceBucket
    ? rankingsResult.rankings.filter(
        (entry) =>
          entry.complianceScore >= selectedComplianceBucket.min &&
          entry.complianceScore <= selectedComplianceBucket.max
      )
    : rankingsResult.rankings;

  const budgetChartData = {
    labels: buyerIntel.budgetDistribution.map((p) => p.label),
    datasets: [
      {
        data: buyerIntel.budgetDistribution.map((p) => p.count),
        backgroundColor: '#34d399',
        borderRadius: 6,
        maxBarThickness: 36,
      },
    ],
  };

  const preferredTypesChartData = {
    labels: buyerIntel.preferredTypes.map((p) => p.label),
    datasets: [
      {
        data: buyerIntel.preferredTypes.map((p) => p.count),
        backgroundColor: buyerIntel.preferredTypes.map(
          (_, i) => TYPE_COLORS[i % TYPE_COLORS.length]
        ),
        borderWidth: 0,
      },
    ],
  };

  const preferredLocationsChartData = {
    labels: buyerIntel.preferredLocations.map((p) => p.label),
    datasets: [
      {
        data: buyerIntel.preferredLocations.map((p) => p.count),
        backgroundColor: '#a78bfa',
        borderRadius: 6,
        maxBarThickness: 22,
      },
    ],
  };

  const salesTrendChartData = {
    labels: salesPerf.monthlyTrend.map((p) => formatMonth(p.month)),
    datasets: [
      {
        data: salesPerf.monthlyTrend.map((p) => p.total),
        borderColor: '#34d399',
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
        pointBackgroundColor: '#34d399',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.35,
        fill: true,
      },
    ],
  };

  return (
    <div className="space-y-8">
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#e8efe3] rounded-2xl px-4 py-3 border border-[#d6c7b2]/30">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-[#2f4736]">Quick Actions:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg overflow-hidden border border-white/50 shadow-sm">
            <button
              type="button"
              onClick={() => setReportFormat('pdf')}
              className={`text-xs px-3 py-1.5 transition-all ${
                reportFormat === 'pdf'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/70 text-[#2f2417] hover:bg-white'
              }`}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => setReportFormat('csv')}
              className={`text-xs px-3 py-1.5 transition-all ${
                reportFormat === 'csv'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/70 text-[#2f2417] hover:bg-white'
              }`}
            >
              CSV
            </button>
          </div>
          <button
            type="button"
            onClick={handleExportReport}
            disabled={isExportingReport}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-3 h-3" />
            {isExportingReport ? 'Preparing Report...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* 1. Executive Summary */}
      <section className="space-y-3">
        <SectionHeader
          icon={Target}
          title="Executive Summary"
          subtitle="How is the business performing?"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[#7c6a57] text-xs uppercase tracking-wider">{card.label}</p>
                    {card.tooltip && <MetricTooltip tooltip={card.tooltip} />}
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50/50 group-hover:bg-emerald-100/50 transition-colors">
                    <Icon className="w-4 h-4 text-emerald-700/70" />
                  </div>
                </div>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">{card.value}</p>
              </div>
            );
          })}
        </div>
        {summary.auditedPropertiesCount === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/50 border border-amber-200/30">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-[#7c6a57]">
              Compliance, pass-rate, and risk figures will populate once properties have been
              audited via the AI Compliance Center below.
            </p>
          </div>
        )}
      </section>

      {/* 2. Business Performance */}
      <section className="space-y-4">
        <SectionHeader
          icon={DollarSign}
          title="Business Performance"
          subtitle="How are sales and revenue trending?"
          action={
            <button
              onClick={() => toggleSection('performance')}
              className="text-[#7c6a57] hover:text-[#2f2417] transition-colors p-1"
            >
              {expandedSections.performance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          }
        />

        {expandedSections.performance && (
          <>
            {salesPerf.isApproximate && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50/50 border border-amber-200/30">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-700">{salesPerf.note}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider">Total Revenue</p>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">
                  {formatCurrency(salesPerf.totalRevenue)}
                </p>
              </div>
              <div className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider">Monthly Average</p>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">
                  {formatCurrency(salesPerf.monthlyAverage)}
                </p>
              </div>
              <div className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200 bg-gradient-to-br from-emerald-50/30 to-transparent">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  Projected Next Month
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                </p>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">
                  {formatCurrency(salesPerf.forecastNextMonth)}
                </p>
              </div>
            </div>

            <div className="admin-panel rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h4 className="text-[#2f2417] font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                  Sales Trend
                </h4>
                {salesPerf.monthlyTrend.length > 0 && (
                  <span className="text-[11px] text-[#7c6a57]">
                    Click a point or select a month below to view completed transactions
                  </span>
                )}
              </div>
              <div className="h-[240px]">
                {salesPerf.monthlyTrend.length === 0 ? (
                  <EmptyState message="No sold properties yet — sales trend will appear here once listings are marked Sold." icon={DollarSign} />
                ) : (
                  <Line data={salesTrendChartData} options={salesTrendOptions} />
                )}
              </div>
              {salesPerf.monthlyTrend.length > 0 && (
                <div
                  role="group"
                  aria-label="Inspect completed transactions by month"
                  className="mt-4 flex flex-wrap items-center gap-2"
                >
                  {salesPerf.monthlyTrend.map((point) => {
                    const monthLabel = formatMonth(point.month);
                    return (
                      <button
                        key={point.month}
                        type="button"
                        aria-label={`View completed transactions for ${monthLabel} (${formatCurrency(point.total)})`}
                        onClick={() =>
                          openDrilldown({
                            kind: 'monthly_revenue',
                            key: point.month,
                            label: monthLabel,
                            chartRevenue: point.total,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/60 text-[#2f2417] border border-[#d6c7b2] hover:bg-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        {monthLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 3. Property Performance */}
      <section className="space-y-4">
        <SectionHeader
          icon={Trophy}
          title="Property Performance"
          subtitle="Compliance health and listing rankings"
          action={
            <button
              onClick={() => toggleSection('rankings')}
              className="text-[#7c6a57] hover:text-[#2f2417] transition-colors p-1"
            >
              {expandedSections.rankings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          }
        />

        {expandedSections.rankings && (
          <>
            {/* Compliance Score Distribution */}
            <div className="admin-panel rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h4 className="text-[#2f2417] font-semibold text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                  Compliance Score Distribution
                </h4>
                {summary.auditedPropertiesCount > 0 && (
                  <span className="text-[11px] text-[#7c6a57]">
                    Click a bar or select a range below to filter rankings
                  </span>
                )}
              </div>
              <div className="h-[200px]">
                {summary.auditedPropertiesCount === 0 ? (
                  <EmptyState message="Not enough data yet." icon={ShieldCheck} />
                ) : (
                  <Bar data={complianceDistData} options={complianceDistOptions} />
                )}
              </div>
              {summary.auditedPropertiesCount > 0 && (
                <div
                  role="group"
                  aria-label="Filter rankings by compliance score range"
                  className="mt-4 flex flex-wrap items-center gap-2"
                >
                  {charts.complianceScoreDistribution.map((bucket) => {
                    const isSelected = selectedComplianceRange === bucket.label;
                    return (
                      <button
                        key={bucket.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleComplianceRange(bucket.label)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                          isSelected
                            ? 'bg-blue-600 text-white border border-blue-600'
                            : 'bg-white/60 text-[#2f2417] border border-[#d6c7b2] hover:bg-white'
                        }`}
                      >
                        {bucket.label} ({bucket.count})
                      </button>
                    );
                  })}
                  {selectedComplianceRange && (
                    <button
                      type="button"
                      onClick={() => setSelectedComplianceRange(null)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Performance Rankings */}
            <div className="admin-panel rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h4 className="text-[#2f2417] font-semibold text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Performance Rankings
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedComplianceRange && (
                    <div className="inline-flex items-center gap-2 text-xs bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full">
                      <span>
                        Compliance: <strong>{selectedComplianceRange}</strong> ({filteredRankings.length}{' '}
                        of {rankingsResult.rankings.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedComplianceRange(null)}
                        className="font-semibold underline hover:text-blue-950 bg-transparent border-none p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-700"
                      >
                        Clear filter
                      </button>
                    </div>
                  )}
                  {rankingsResult.unauditedCount > 0 && (
                    <span className="text-xs text-[#7c6a57] bg-white/50 px-3 py-1 rounded-full">
                      {rankingsResult.unauditedCount} property
                      {rankingsResult.unauditedCount > 1 ? 's' : ''} not yet audited
                    </span>
                  )}
                </div>
              </div>

              {selectedComplianceRange &&
                selectedBucketChartCount !== null &&
                selectedBucketChartCount !== filteredRankings.length && (
                  <p className="text-xs text-[#7c6a57] mb-3">
                    Showing {filteredRankings.length} matching ranked{' '}
                    {filteredRankings.length === 1 ? 'listing' : 'listings'} (chart bucket count:{' '}
                    {selectedBucketChartCount}).
                  </p>
                )}

              {rankingsResult.rankings.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-[#d6c7b2] mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[#7c6a57] text-sm">
                    No audited properties yet — generate an AI Compliance Audit on a property to see it ranked here.
                  </p>
                </div>
              ) : filteredRankings.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-[#7c6a57] text-sm">
                    No ranked properties fall in the {selectedComplianceRange} compliance range.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedComplianceRange(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table w-full text-sm">
                    <thead>
                      <tr className="text-left text-[#7c6a57] text-xs uppercase tracking-wider border-b border-[#d6c7b2]">
                        <th className="py-3 pr-4 font-semibold">Rank</th>
                        <th className="py-3 pr-4 font-semibold">Property</th>
                        <th className="py-3 pr-4 font-semibold">Compliance</th>
                        <th className="py-3 pr-4 font-semibold">Portfolio Percentile</th>
                        <th className="py-3 pr-4 font-semibold">Market Readiness</th>
                        <th className="py-3 font-semibold">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRankings.map((entry, index) => (
                        <tr
                          key={entry.propertyId}
                          tabIndex={onNavigate ? 0 : undefined}
                          onClick={
                            onNavigate
                              ? () =>
                                  onNavigate({
                                    page: 'properties',
                                    propertyId: entry.propertyId,
                                  })
                              : undefined
                          }
                          onKeyDown={
                            onNavigate
                              ? (e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onNavigate({
                                      page: 'properties',
                                      propertyId: entry.propertyId,
                                    });
                                  }
                                }
                              : undefined
                          }
                          aria-label={
                            onNavigate
                              ? `Edit ${entry.name}, rank ${entry.rank}, ${entry.complianceScore}% compliance, ${entry.riskLevel} risk`
                              : undefined
                          }
                          className={`border-b border-[#e0d5c3] last:border-none ${
                            index % 2 === 0 ? 'bg-white/20' : ''
                          } hover:bg-white/50 transition-colors ${
                            onNavigate
                              ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600'
                              : ''
                          }`}
                        >
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              entry.rank === 1 ? 'bg-amber-100 text-amber-700' :
                              entry.rank === 2 ? 'bg-gray-200 text-gray-600' :
                              entry.rank === 3 ? 'bg-amber-50/80 text-amber-600' :
                              'text-[#7c6a57]'
                            }`}>
                              {entry.rank}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                entry.riskLevel === 'Low' ? 'bg-emerald-500' :
                                entry.riskLevel === 'Medium' ? 'bg-amber-500' :
                                'bg-rose-500'
                              }`} />
                              <div>
                                <p className="text-[#2f2417] font-medium">{entry.name}</p>
                                <p className="text-[#7c6a57] text-xs">
                                  {entry.type} &middot; {entry.location}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[#5d503f] text-sm font-medium">{entry.complianceScore}%</span>
                              <div className="w-16 h-1.5 bg-[#e0d5c3] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                  style={{ width: `${entry.complianceScore}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-sm font-medium ${
                              entry.successRate >= 70 ? 'text-emerald-600' :
                              entry.successRate >= 40 ? 'text-amber-600' :
                              'text-rose-600'
                            }`}>
                              {entry.successRate}%
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[#5d503f] text-sm">{entry.marketReadinessScore}%</span>
                              <div className="w-16 h-1.5 bg-[#e0d5c3] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-400 rounded-full transition-all duration-500"
                                  style={{ width: `${entry.marketReadinessScore}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <RiskBadge level={entry.riskLevel} />
                              {onNavigate && entry.riskLevel === 'High' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate({
                                      page: 'properties',
                                      propertyId: entry.propertyId,
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                >
                                  Review documents
                                </button>
                              )}
                              {onNavigate && entry.riskLevel !== 'High' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate({
                                      page: 'properties',
                                      propertyId: entry.propertyId,
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#5d503f] bg-white/70 border border-[#d6c7b2] hover:bg-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                                >
                                  Edit property
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-[#7c6a57] mt-4 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Portfolio Percentile reflects how this property's document-readiness score compares to the rest of the
                audited portfolio. Market Readiness blends document completeness with price
                competitiveness against similar listings.
              </p>
              <p className="text-[11px] text-[#7c6a57] mt-1">
                High-risk rows need document checks before they can be relied on for a sale.
              </p>
            </div>

          </>
        )}
      </section>

      {/* 4. Buyer Intelligence */}
      <section className="space-y-4">
        <SectionHeader
          icon={Users}
          title="Buyer Intelligence"
          subtitle="What are buyers looking for?"
          action={
            <button
              onClick={() => toggleSection('buyers')}
              className="text-[#7c6a57] hover:text-[#2f2417] transition-colors p-1"
            >
              {expandedSections.buyers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          }
        />

        {expandedSections.buyers && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  Average Buyer Budget
                  <MetricTooltip tooltip="Average budget across all buyers with preferences set" />
                </p>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">
                  {formatCurrency(buyerIntel.averageBudget)}
                </p>
              </div>
              <div className="admin-panel rounded-2xl p-5 hover:shadow-lg transition-all duration-200">
                <p className="text-[#7c6a57] text-xs uppercase tracking-wider flex items-center gap-1.5">
                  Buyers with Preferences Set
                  <MetricTooltip tooltip="Total number of buyers who have set their preferences" />
                </p>
                <p className="text-[#2f2417] text-2xl font-bold mt-2">
                  {buyerIntel.totalBuyersWithPreferences.toLocaleString()}
                </p>
              </div>
            </div>

            {buyerIntel.totalBuyersWithPreferences === 0 ? (
              <div className="admin-panel rounded-2xl p-12 text-center">
                <Users className="w-12 h-12 text-[#d6c7b2] mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-[#7c6a57] text-sm">
                  No buyers have set preferences yet — charts will populate as buyers use the Preferences tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="admin-panel rounded-2xl p-6 flex flex-col">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Budget Distribution
                  </h4>
                  <div className="h-[220px]">
                    <Bar data={budgetChartData} options={budgetBarOptions} />
                  </div>
                  {buyerIntel.budgetDistribution.length > 0 && (
                    <div
                      role="group"
                      aria-label="Inspect buyers by budget bucket"
                      className="mt-3 flex flex-wrap gap-1.5"
                    >
                      {buyerIntel.budgetDistribution.map((bucket) => (
                        <button
                          key={bucket.label}
                          type="button"
                          aria-label={`View buyers in budget range ${bucket.label} (${bucket.count})`}
                          onClick={() =>
                            openDrilldown({
                              kind: 'budget',
                              key: bucket.label,
                              label: bucket.label,
                              chartCount: bucket.count,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/60 text-[#2f2417] border border-[#d6c7b2] hover:bg-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        >
                          {bucket.label} ({bucket.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="admin-panel rounded-2xl p-6 flex flex-col">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Preferred Property Types
                  </h4>
                  <div className="h-[220px]">
                    {buyerIntel.preferredTypes.length === 0 ? (
                      <EmptyState message="No data yet." icon={Home} />
                    ) : (
                      <Doughnut
                        data={preferredTypesChartData}
                        options={preferredTypesDoughnutOptions}
                        plugins={[preferredTypesSliceLabels]}
                      />
                    )}
                  </div>
                  {buyerIntel.preferredTypes.length > 0 && (
                    <div
                      role="group"
                      aria-label="Inspect buyers by preferred property type"
                      className="mt-3 flex flex-wrap gap-1.5"
                    >
                      {buyerIntel.preferredTypes.map((segment) => (
                        <button
                          key={segment.label}
                          type="button"
                          aria-label={`View buyers preferring ${segment.label} (${segment.count})`}
                          onClick={() =>
                            openDrilldown({
                              kind: 'preferred_type',
                              key: segment.label,
                              label: segment.label,
                              chartCount: segment.count,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/60 text-[#2f2417] border border-[#d6c7b2] hover:bg-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        >
                          {segment.label} ({segment.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="admin-panel rounded-2xl p-6 flex flex-col">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Preferred Locations
                  </h4>
                  <div className="h-[220px]">
                    {buyerIntel.preferredLocations.length === 0 ? (
                      <EmptyState message="No data yet." icon={MapPin} />
                    ) : (
                      <Bar
                        data={preferredLocationsChartData}
                        options={preferredLocationsInteractiveOptions}
                        plugins={[preferredLocationsValueLabels]}
                      />
                    )}
                  </div>
                  {buyerIntel.preferredLocations.length > 0 && (
                    <div
                      role="group"
                      aria-label="Inspect buyers by preferred location"
                      className="mt-3 flex flex-wrap gap-1.5"
                    >
                      {buyerIntel.preferredLocations.map((loc) => (
                        <button
                          key={loc.label}
                          type="button"
                          aria-label={`View buyers preferring ${loc.label} (${loc.count})`}
                          onClick={() =>
                            openDrilldown({
                              kind: 'preferred_location',
                              key: loc.label,
                              label: loc.label,
                              chartCount: loc.count,
                            })
                          }
                          className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/60 text-[#2f2417] border border-[#d6c7b2] hover:bg-white transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                        >
                          {loc.label} ({loc.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 5. Property Type Decisions */}
      {decisionsLoading && (
        <div className="admin-panel rounded-2xl p-6">
          <p className="text-sm text-[#7c6a57]">Loading recommended actions…</p>
        </div>
      )}

      {!decisionsLoading && decisionsError && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-rose-50/50 border border-rose-200/30 text-sm text-rose-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{decisionsError}</span>
        </div>
      )}

      {!decisionsLoading && !decisionsError && typeDecisions && (
        <>
          <section className="space-y-4">
            <SectionHeader
              icon={Target}
              title="Property Type Decisions"
              subtitle="Where buyer demand and available supply point to an action."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {typeDecisions.typeDecisions.decisions.map((item) => {
                const badge = TYPE_DECISION_BADGES[item.decision];
                const gapText =
                  item.gapPointsDisplay === null
                    ? 'n/a'
                    : `${item.gapPointsDisplay > 0 ? '+' : ''}${item.gapPointsDisplay} pts`;

                const isInspectable =
                  item.decision !== 'no_records' &&
                  item.decision !== 'insufficient_data' &&
                  (item.buyers > 0 || item.listings > 0);

                return (
                  <div
                    key={item.type}
                    tabIndex={isInspectable ? 0 : undefined}
                    role={isInspectable ? 'button' : undefined}
                    aria-label={
                      isInspectable
                        ? `Inspect ${item.type} decision details (${badge.label}, ${item.buyers} buyers, ${item.listings} available listings)`
                        : undefined
                    }
                    onClick={isInspectable ? () => openTypeDecisionDrilldown(item) : undefined}
                    onKeyDown={
                      isInspectable
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openTypeDecisionDrilldown(item);
                            }
                          }
                        : undefined
                    }
                    className={`admin-panel rounded-2xl p-5 flex flex-col justify-between gap-3 transition-all ${
                      isInspectable
                        ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                        : ''
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#2f2417]">{item.type}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-[#5d503f] leading-relaxed">
                        {formatTypeDecisionText(item)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#e8e0d5] space-y-1 text-[11px] text-[#7c6a57]">
                      <p>
                        Buyers: {item.buyers} &middot; Listings: {item.listings} &middot; Gap:{' '}
                        {gapText}
                      </p>
                      <p>
                        Ready: low {item.readiness.low}, medium {item.readiness.medium}, high{' '}
                        {item.readiness.high}, not audited {item.readiness.notAudited}
                      </p>
                      {/* The type response has no listing IDs, so no per-listing action is available. */}
                      <div className="pt-1 flex flex-wrap items-center gap-3">
                        {isInspectable && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTypeDecisionDrilldown(item);
                            }}
                            className="inline-flex items-center text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline bg-transparent border-none p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                          >
                            Inspect details
                          </button>
                        )}
                        {((item.decision === 'shortage' && item.blockingCount > 0) ||
                          (item.decision === 'surplus' && item.unauditedCount > 0)) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate?.({ page: 'properties', propertyType: item.type });
                            }}
                            className="inline-flex items-center text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline bg-transparent border-none p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                          >
                            Open listings of this type
                          </button>
                        )}
                      </div>
                      {item.decision === 'surplus' && item.unauditedCount === 0 && (
                        <p className="mt-1 text-[11px] italic text-[#7c6a57]">
                          No action is recorded for hold decisions.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-[#7c6a57]">
              Demand is stated buyer preference. Supply is Available listings with a valid price.
              Decisions use provisional thresholds pending confirmation. Null preferences:{' '}
              {typeDecisions.typeDecisions.nullDemandCount} (excluded from shares).
            </p>
            <p className="text-xs text-[#7c6a57]">Follow-ups are shown on the Dashboard.</p>
          </section>
        </>
      )}

      <AnalyticsDrilldownModal
        selection={drilldownSelection}
        onClose={() => setDrilldownSelection(null)}
        buyers={buyersCache}
        buyersLoading={buyersLoading}
        buyersError={buyersError}
        onRetryBuyers={() => void ensureBuyersLoaded(true)}
        transactions={transactionsCache}
        transactionsLoading={transactionsLoading}
        transactionsError={transactionsError}
        onRetryTransactions={() => void ensureTransactionsLoaded(true)}
      />

      <TypeDecisionDrilldownModal
        decision={selectedTypeDecision}
        nullDemandCount={typeDecisions?.typeDecisions.nullDemandCount ?? 0}
        onClose={() => setSelectedTypeDecision(null)}
        buyers={buyersCache}
        buyersLoading={buyersLoading}
        buyersError={buyersError}
        onRetryBuyers={() => void ensureBuyersLoaded(true)}
        properties={propertiesCache}
        propertiesLoading={propertiesLoading}
        propertiesError={propertiesError}
        onRetryProperties={() => void ensurePropertiesLoaded(true)}
        rankings={rankingsResult.rankings}
        onNavigate={onNavigate}
      />
    </div>
  );

  // Legacy: removed in cleanup step. Not rendered.
  function LegacyPortfolioNarrative() {
    return (
      <section className="space-y-4">
        <SectionHeader
          icon={Sparkles}
          title="AI Portfolio Insights"
          subtitle="What strategic actions should management take?"
          action={
            <button
              onClick={() => toggleSection('insights')}
              className="text-[#7c6a57] hover:text-[#2f2417] transition-colors p-1"
            >
              {expandedSections.insights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          }
        />

        {expandedSections.insights && (
          <div className="admin-panel rounded-2xl p-6">
            {!insightsResult && !isGeneratingInsights && (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-[#2f2417] font-medium text-sm mb-2">Generate AI-Powered Insights</p>
                <p className="text-[#7c6a57] text-sm max-w-md mx-auto mb-6">
                  Get an executive summary of portfolio health, market trends, buyer behavior,
                  and strategic recommendations — written by AI from your live analytics data.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateInsights}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border-none"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Portfolio Insights
                </button>
              </div>
            )}

            {isGeneratingInsights && (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[#2f2417] font-medium text-sm">Analyzing portfolio data...</p>
                <p className="text-[#7c6a57] text-xs mt-1">This may take a few moments</p>
              </div>
            )}

            {insightsError && (
              <div className="flex items-start gap-2 p-4 rounded-xl bg-rose-50/50 border border-rose-200/30 text-sm text-rose-700 mb-4">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{insightsError}</span>
              </div>
            )}

            {insightsResult && !isGeneratingInsights && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#d6c7b2]">
                  <div className="flex items-center gap-2 text-xs text-[#7c6a57]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    {insightsResult.narrativeOrigin === 'AI_GENERATED'
                      ? 'AI-generated'
                      : 'System-generated (AI unavailable)'}
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateInsights}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>

                {insightsResult.fallbackReason && (
                  <p className="text-xs text-[#7c6a57]" role="note">
                    {insightsResult.fallbackReason === 'AI_TIMEOUT'
                      ? 'The AI service timed out; this summary is based on current portfolio data.'
                      : insightsResult.fallbackReason === 'AI_INVALID_RESPONSE'
                        ? 'The AI response was incomplete or invalid; this summary is based on current portfolio data.'
                        : 'The AI service was unavailable; this summary is based on current portfolio data.'}
                  </p>
                )}

                {(
                  [
                    ['Portfolio Health', insightsResult.insights.portfolioHealth, '📊'],
                    ['Market Trends', insightsResult.insights.marketTrends, '📈'],
                    ['Buyer Behavior', insightsResult.insights.buyerBehavior, '👥'],
                    ['Top-Performing Categories', insightsResult.insights.topPerformingCategories, '🏆'],
                    ['Risks', insightsResult.insights.risks, '⚠️'],
                    ['Recommendations', insightsResult.insights.recommendations, '💡'],
                  ] as const
                ).map(([label, text, emoji]) => (
                  <div key={label} className="pb-4 border-b border-[#e8e0d5] last:border-none last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{emoji}</span>
                      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                        {label}
                      </p>
                    </div>
                    <p className="text-sm text-[#2f2417] leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }
};
