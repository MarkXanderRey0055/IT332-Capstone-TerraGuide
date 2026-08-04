import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Home,
  Users,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Trophy,
  AlertTriangle,
} from 'lucide-react';
import {
  getDashboardSummary,
  getChartData,
  getTopProperties,
  getAttentionProperties,
  type DashboardSummary,
  type ChartData as AnalyticsChartData,
  type TopProperty,
  type AttentionProperty,
} from '../../services/AnalyticsService';

// Chart.js is modular in v4 — only the pieces we actually use need to be
// registered, once, for the whole app.
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

interface AdminAnalyticsProps {
  onToast?: (message: string) => void;
}

// Shared dark-theme tuning so every chart looks like it belongs on this
// page instead of Chart.js's default light-mode styling.
const AXIS_COLOR = 'rgba(156, 163, 175, 0.7)'; // gray-400-ish
const GRID_COLOR = 'rgba(255, 255, 255, 0.06)';
const LEGEND_COLOR = 'rgba(209, 213, 219, 0.85)'; // gray-300-ish

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0f1f16',
      titleColor: '#ffffff',
      bodyColor: '#d1d5db',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
    },
  },
  scales: {
    x: {
      ticks: { color: AXIS_COLOR, font: { size: 11 } },
      grid: { color: GRID_COLOR },
    },
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
    tooltip: {
      backgroundColor: '#0f1f16',
      titleColor: '#ffffff',
      bodyColor: '#d1d5db',
      borderColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
    },
  },
};

// Same palette AdminProperties already uses for status badges — Available
// green, Reserved amber, Sold neutral gray — kept consistent here instead
// of inventing a new one just for the chart.
const STATUS_COLORS: Record<string, string> = {
  Available: '#34d399',
  Reserved: '#fbbf24',
  Sold: '#9ca3af',
};

const TYPE_COLORS = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];

const formatCurrency = (amount: number) =>
  `₱${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ onToast }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<AnalyticsChartData | null>(null);
  const [topProperties, setTopProperties] = useState<TopProperty[]>([]);
  const [attentionProperties, setAttentionProperties] = useState<AttentionProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    const loadAnalytics = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const [summaryData, chartData, topData, attentionData] = await Promise.all([
          getDashboardSummary(),
          getChartData(),
          getTopProperties(5),
          getAttentionProperties(),
        ]);

        if (isCancelled) return;
        setSummary(summaryData);
        setCharts(chartData);
        setTopProperties(topData);
        setAttentionProperties(attentionData);
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

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-16 text-center">
        <p className="text-gray-400 text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-16 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <p className="text-white font-semibold text-sm">Couldn't load analytics</p>
        <p className="text-gray-500 text-xs mt-1">{loadError}</p>
      </div>
    );
  }

  if (!summary || !charts) {
    return null;
  }

  const kpiCards = [
    { label: 'Total Properties', value: summary.totalProperties.toLocaleString(), icon: Home },
    { label: 'Available', value: summary.availableProperties.toLocaleString(), icon: Home },
    { label: 'Reserved', value: summary.reservedProperties.toLocaleString(), icon: Home },
    { label: 'Sold', value: summary.soldProperties.toLocaleString(), icon: Home },
    { label: 'Total Buyers', value: summary.totalBuyers.toLocaleString(), icon: Users },
    {
      label: 'Avg. Compliance Score',
      value: `${summary.averageComplianceScore}%`,
      icon: ShieldCheck,
    },
    {
      label: 'Avg. Success Rate',
      value: `${summary.averageSuccessRate}%`,
      icon: TrendingUp,
    },
    {
      label: 'Est. Portfolio Value',
      value: formatCurrency(summary.estimatedPortfolioValue),
      icon: Wallet,
    },
  ];

  const statusChartData = {
    labels: charts.propertyStatusDistribution.map((point) => point.label),
    datasets: [
      {
        data: charts.propertyStatusDistribution.map((point) => point.count),
        backgroundColor: charts.propertyStatusDistribution.map(
          (point) => STATUS_COLORS[point.label] ?? '#6b7280'
        ),
        borderWidth: 0,
      },
    ],
  };

  const typeChartData = {
    labels: charts.propertyTypeDistribution.map((point) => point.label),
    datasets: [
      {
        data: charts.propertyTypeDistribution.map((point) => point.count),
        backgroundColor: charts.propertyTypeDistribution.map(
          (_, index) => TYPE_COLORS[index % TYPE_COLORS.length]
        ),
        borderWidth: 0,
      },
    ],
  };

  const preferredTypeChartData = {
    labels: charts.buyerPreferredTypes.map((point) => point.label),
    datasets: [
      {
        label: 'Buyers',
        data: charts.buyerPreferredTypes.map((point) => point.count),
        backgroundColor: '#34d399',
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  const complianceChartData = {
    labels: charts.complianceScoreDistribution.map((point) => point.label),
    datasets: [
      {
        label: 'Properties',
        data: charts.complianceScoreDistribution.map((point) => point.count),
        backgroundColor: '#60a5fa',
        borderRadius: 6,
        maxBarThickness: 40,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-gray-400 text-xs uppercase tracking-wider">{card.label}</p>
                <Icon className="w-4 h-4 text-emerald-400/70" />
              </div>
              <p className="text-white text-2xl font-bold mt-2">{card.value}</p>
            </div>
          );
        })}
      </div>

      {summary.auditedPropertiesCount === 0 && (
        <p className="text-xs text-gray-500 -mt-2">
          Compliance and success-rate figures will populate once properties have been audited via
          the AI Compliance Auditor.
        </p>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <h3 className="text-white font-semibold text-sm mb-4">Property Status Distribution</h3>
          <div className="h-[260px]">
            {charts.propertyStatusDistribution.length === 0 ? (
              <EmptyChartState />
            ) : (
              <Doughnut data={statusChartData} options={doughnutOptions} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <h3 className="text-white font-semibold text-sm mb-4">Property Type Distribution</h3>
          <div className="h-[260px]">
            {charts.propertyTypeDistribution.length === 0 ? (
              <EmptyChartState />
            ) : (
              <Doughnut data={typeChartData} options={doughnutOptions} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <h3 className="text-white font-semibold text-sm mb-4">Buyer Preferred Property Types</h3>
          <div className="h-[260px]">
            {charts.buyerPreferredTypes.length === 0 ? (
              <EmptyChartState />
            ) : (
              <Bar data={preferredTypeChartData} options={barOptions} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
          <h3 className="text-white font-semibold text-sm mb-4">Compliance Score Distribution</h3>
          <div className="h-[260px]">
            {summary.auditedPropertiesCount === 0 ? (
              <EmptyChartState />
            ) : (
              <Bar data={complianceChartData} options={barOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Top Performing Properties */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-white font-semibold text-sm">
            Top Performing Properties (by Compliance Score)
          </h3>
        </div>

        {topProperties.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">
            No audited properties yet — generate an AI Compliance Audit on a property to see it
            ranked here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="py-2 pr-4">Property</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Compliance Score</th>
                  <th className="py-2">Audited</th>
                </tr>
              </thead>
              <tbody>
                {topProperties.map((property) => (
                  <tr
                    key={property.propertyId}
                    className="border-b border-white/[0.04] last:border-none"
                  >
                    <td className="py-3 pr-4 text-white font-medium">{property.name}</td>
                    <td className="py-3 pr-4 text-gray-400">{property.type}</td>
                    <td className="py-3 pr-4 text-gray-400">{property.location}</td>
                    <td className="py-3 pr-4 text-gray-400">{property.status}</td>
                    <td className="py-3 pr-4">
                      <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-500/15 text-emerald-400">
                        {property.complianceScore}%
                      </span>
                    </td>
                    <td className="py-3 text-gray-500 text-xs">
                      {formatDate(property.auditedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Properties Requiring Attention */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <h3 className="text-white font-semibold text-sm">Properties Requiring Attention</h3>
        </div>

        {attentionProperties.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">
            Nothing needs attention right now — every property is audited and meets the
            compliance bar.
          </p>
        ) : (
          <div className="space-y-3">
            {attentionProperties.map((property) => (
              <div
                key={property.propertyId}
                className="p-4 rounded-xl border border-rose-500/10 bg-rose-500/[0.03] flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold">{property.name}</p>
                    <span className="text-xs text-gray-500">
                      {property.type} &middot; {property.location}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {property.reasons.map((reason) => (
                      <span
                        key={reason}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded bg-rose-500/15 text-rose-400"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                {property.complianceScore !== null && (
                  <span className="shrink-0 px-2.5 py-1 text-xs font-bold rounded-full bg-white/[0.06] text-gray-300">
                    {property.complianceScore}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyChartState: React.FC = () => (
  <div className="h-full flex items-center justify-center">
    <p className="text-gray-500 text-xs">Not enough data yet.</p>
  </div>
);