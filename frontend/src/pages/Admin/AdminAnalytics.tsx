import React, { useEffect, useState } from 'react';
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
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  Zap,
  Award,
  TrendingDown,
  MapPin,
} from 'lucide-react';
import {
  getDashboardSummary,
  getChartData,
  getTopProperties,
  getAttentionProperties,
  getPropertyRankings,
  getBuyerIntelligence,
  getSalesPerformance,
  generatePortfolioInsights,
  type DashboardSummary,
  type ChartData as AnalyticsChartData,
  type TopProperty,
  type AttentionProperty,
  type PropertyRankingsResult,
  type BuyerIntelligence,
  type SalesPerformance,
  type PortfolioInsightsResult,
  type RiskLevel,
} from '../../services/AnalyticsService';

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

interface AdminAnalyticsProps {
  onToast?: (message: string) => void;
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

const STATUS_COLORS: Record<string, string> = {
  Available: '#34d399',
  Reserved: '#fbbf24',
  Sold: '#9ca3af',
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

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
  icon: Icon 
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

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ onToast }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<AnalyticsChartData | null>(null);
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);
  const [attentionProperties, setAttentionProperties] = useState<AttentionProperty[]>([]);
  const [rankingsResult, setRankingsResult] = useState<PropertyRankingsResult | null>(null);
  const [buyerIntel, setBuyerIntel] = useState<BuyerIntelligence | null>(null);
  const [salesPerf, setSalesPerf] = useState<SalesPerformance | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [insightsResult, setInsightsResult] = useState<PortfolioInsightsResult | null>(null);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState('');

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState({
    rankings: true,
    compliance: true,
    performance: true,
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
          topData,
          attentionData,
          rankingsData,
          buyerData,
          salesData,
        ] = await Promise.all([
          getDashboardSummary(),
          getChartData(),
          getTopProperties(5),
          getAttentionProperties(),
          getPropertyRankings(),
          getBuyerIntelligence(),
          getSalesPerformance(),
        ]);

        if (isCancelled) return;
        setSummary(summaryData);
        setCharts(chartData);
        setTopProperties(topData);
        setAttentionProperties(attentionData);
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

  const handleGenerateInsights = async () => {
    setIsGeneratingInsights(true);
    setInsightsError('');
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

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
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
      label: 'Total Properties', 
      value: summary.totalProperties.toLocaleString(), 
      icon: Home,
      tooltip: 'Total number of properties in the portfolio',
    },
    { 
      label: 'Total Buyers', 
      value: summary.totalBuyers.toLocaleString(), 
      icon: Users,
      tooltip: 'Total number of registered buyers',
    },
    {
      label: 'Avg. Compliance Score',
      value: `${summary.averageComplianceScore}%`,
      icon: ShieldCheck,
      tooltip: 'Average compliance score across all audited properties',
    },
    {
      label: 'Avg. Success Rate',
      value: `${summary.averageSuccessRate}%`,
      icon: TrendingUp,
      tooltip: 'Average success rate compared to portfolio average',
    },
    {
      label: 'High-Risk Listings',
      value: summary.highRiskListingsCount.toLocaleString(),
      icon: AlertTriangle,
      tooltip: 'Properties flagged with high risk that need immediate attention',
    },
  ];

  const statusChartData = {
    labels: charts.propertyStatusDistribution.map((p) => p.label),
    datasets: [
      {
        data: charts.propertyStatusDistribution.map((p) => p.count),
        backgroundColor: charts.propertyStatusDistribution.map(
          (p) => STATUS_COLORS[p.label] ?? '#6b7280'
        ),
        borderWidth: 0,
      },
    ],
  };

  const typeChartData = {
    labels: charts.propertyTypeDistribution.map((p) => p.label),
    datasets: [
      {
        data: charts.propertyTypeDistribution.map((p) => p.count),
        backgroundColor: charts.propertyTypeDistribution.map(
          (_, i) => TYPE_COLORS[i % TYPE_COLORS.length]
        ),
        borderWidth: 0,
      },
    ],
  };

  const complianceDistData = {
    labels: charts.complianceScoreDistribution.map((p) => p.label),
    datasets: [
      {
        data: charts.complianceScoreDistribution.map((p) => p.count),
        backgroundColor: '#60a5fa',
        borderRadius: 6,
        maxBarThickness: 32,
      },
    ],
  };

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
          <button className="text-xs px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white transition-all shadow-sm flex items-center gap-1.5">
            <Download className="w-3 h-3" />
            Export Report
          </button>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white transition-all shadow-sm flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            This Month
          </button>
          <button className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm">
            Schedule Audit
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
              Compliance, success-rate, and risk figures will populate once properties have been
              audited via the AI Compliance Center below.
            </p>
          </div>
        )}
      </section>

      {/* 2 + 6. Market Intelligence / Property Performance Rankings */}
      <section className="space-y-4">
        <SectionHeader
          icon={Trophy}
          title="Property Performance Rankings"
          subtitle="Which listings are attracting buyers?"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="admin-panel rounded-2xl p-6">
                <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                  Property Status Distribution
                </h4>
                <div className="h-[220px]">
                  {charts.propertyStatusDistribution.length === 0 ? (
                    <EmptyState message="No properties yet." icon={Home} />
                  ) : (
                    <Doughnut data={statusChartData} options={doughnutOptions} />
                  )}
                </div>
              </div>
              <div className="admin-panel rounded-2xl p-6">
                <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                  Property Type Distribution
                </h4>
                <div className="h-[220px]">
                  {charts.propertyTypeDistribution.length === 0 ? (
                    <EmptyState message="No properties yet." icon={Home} />
                  ) : (
                    <Doughnut data={typeChartData} options={doughnutOptions} />
                  )}
                </div>
              </div>
            </div>

            <div className="admin-panel rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[#2f2417] font-semibold text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Performance Rankings
                </h4>
                {rankingsResult.unauditedCount > 0 && (
                  <span className="text-xs text-[#7c6a57] bg-white/50 px-3 py-1 rounded-full">
                    {rankingsResult.unauditedCount} property
                    {rankingsResult.unauditedCount > 1 ? 's' : ''} not yet audited
                  </span>
                )}
              </div>

              {rankingsResult.rankings.length === 0 ? (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-[#d6c7b2] mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-[#7c6a57] text-sm">
                    No audited properties yet — generate an AI Compliance Audit on a property to see it ranked here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="admin-table w-full text-sm">
                    <thead>
                      <tr className="text-left text-[#7c6a57] text-xs uppercase tracking-wider border-b border-[#d6c7b2]">
                        <th className="py-3 pr-4 font-semibold">Rank</th>
                        <th className="py-3 pr-4 font-semibold">Property</th>
                        <th className="py-3 pr-4 font-semibold">Compliance</th>
                        <th className="py-3 pr-4 font-semibold">Success Rate</th>
                        <th className="py-3 pr-4 font-semibold">Market Readiness</th>
                        <th className="py-3 font-semibold">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingsResult.rankings.map((entry, index) => (
                        <tr
                          key={entry.propertyId}
                          className={`border-b border-[#e0d5c3] last:border-none ${
                            index % 2 === 0 ? 'bg-white/20' : ''
                          } hover:bg-white/40 transition-colors`}
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
                            <RiskBadge level={entry.riskLevel} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-[#7c6a57] mt-4 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Success Rate reflects how this property's compliance score compares to the rest of the
                audited portfolio. Market Readiness blends compliance completeness with price
                competitiveness against similar listings.
              </p>
            </div>
          </>
        )}
      </section>

      {/* 3. AI Compliance Center */}
      <section className="space-y-4">
        <SectionHeader
          icon={ShieldCheck}
          title="AI Compliance Center"
          subtitle="Which listings need compliance improvements?"
          action={
            <button
              onClick={() => toggleSection('compliance')}
              className="text-[#7c6a57] hover:text-[#2f2417] transition-colors p-1"
            >
              {expandedSections.compliance ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          }
        />

        {expandedSections.compliance && (
          <>
            <div className="admin-panel rounded-2xl p-6">
              <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                Compliance Score Distribution
              </h4>
              <div className="h-[200px]">
                {summary.auditedPropertiesCount === 0 ? (
                  <EmptyState message="Not enough data yet." icon={ShieldCheck} />
                ) : (
                  <Bar data={complianceDistData} options={barOptions} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="admin-panel rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-amber-50">
                    <Trophy className="w-4 h-4 text-amber-500" />
                  </div>
                  <h4 className="text-[#2f2417] font-semibold text-sm">Top Performing Properties</h4>
                </div>
                {topProperties.length === 0 ? (
                  <div className="text-center py-6">
                    <Trophy className="w-8 h-8 text-[#d6c7b2] mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-[#7c6a57] text-sm">No audited properties yet.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {topProperties.map((p) => (
                      <li
                        key={p.propertyId}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/40 hover:bg-white/60 transition-colors"
                      >
                        <div>
                          <p className="text-[#2f2417] text-sm font-medium">{p.name}</p>
                          <p className="text-[#7c6a57] text-xs">{formatDate(p.auditedAt)}</p>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-600">
                          {p.complianceScore}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="admin-panel rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-rose-50">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <h4 className="text-[#2f2417] font-semibold text-sm">Properties Requiring Attention</h4>
                </div>
                {attentionProperties.length === 0 ? (
                  <div className="text-center py-6">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-[#7c6a57] text-sm">Nothing needs attention right now.</p>
                  </div>
                ) : (
                  <ul className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#d6c7b2] scrollbar-track-transparent">
                    {attentionProperties.map((p) => (
                      <li key={p.propertyId} className="p-3 rounded-xl bg-white/40 hover:bg-white/60 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[#2f2417] text-sm font-medium truncate">{p.name}</p>
                          <RiskBadge level={p.riskLevel} />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.reasons.map((reason, idx) => (
                            <span key={reason} className="text-[10px] text-[#7c6a57] bg-white/30 px-2 py-0.5 rounded-full">
                              {reason}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 4. Business Performance */}
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
              <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                Sales Trend
              </h4>
              <div className="h-[240px]">
                {salesPerf.monthlyTrend.length === 0 ? (
                  <EmptyState message="No sold properties yet — sales trend will appear here once listings are marked Sold." icon={DollarSign} />
                ) : (
                  <Line data={salesTrendChartData} options={lineOptions} />
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* 5. Buyer Intelligence */}
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
                <div className="admin-panel rounded-2xl p-6">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Budget Distribution
                  </h4>
                  <div className="h-[220px]">
                    <Bar data={budgetChartData} options={barOptions} />
                  </div>
                </div>
                <div className="admin-panel rounded-2xl p-6">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Preferred Property Types
                  </h4>
                  <div className="h-[220px]">
                    {buyerIntel.preferredTypes.length === 0 ? (
                      <EmptyState message="No data yet." icon={Home} />
                    ) : (
                      <Doughnut data={preferredTypesChartData} options={doughnutOptions} />
                    )}
                  </div>
                </div>
                <div className="admin-panel rounded-2xl p-6">
                  <h4 className="text-[#2f2417] font-semibold text-xs mb-4 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    Preferred Locations
                  </h4>
                  <div className="h-[220px]">
                    {buyerIntel.preferredLocations.length === 0 ? (
                      <EmptyState message="No data yet." icon={MapPin} />
                    ) : (
                      <Bar data={preferredLocationsChartData} options={horizontalBarOptions} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* 7. AI Portfolio Insights */}
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
                    Generated from live portfolio data just now
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateInsights}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors bg-transparent border-none cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>

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
    </div>
  );
};