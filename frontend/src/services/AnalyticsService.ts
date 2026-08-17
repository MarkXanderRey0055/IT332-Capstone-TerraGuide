import { apiRequest } from '../utils/api';

export interface DashboardSummary {
  totalProperties: number;
  availableProperties: number;
  reservedProperties: number;
  soldProperties: number;
  totalBuyers: number;
  propertiesAddedThisMonth: number;
  buyersRegisteredThisMonth: number;
  averageComplianceScore: number;
  averageSuccessRate: number;
  estimatedPortfolioValue: number;
  highRiskListingsCount: number;
  auditedPropertiesCount: number;
}

export interface ChartPoint {
  label: string;
  count: number;
}

export interface ChartData {
  propertyStatusDistribution: ChartPoint[];
  propertyTypeDistribution: ChartPoint[];
  buyerPreferredTypes: ChartPoint[];
  complianceScoreDistribution: ChartPoint[];
}

export interface TopProperty {
  propertyId: string;
  name: string;
  type: string;
  location: string;
  status: string;
  complianceScore: number;
  auditedAt: string;
}

export interface AttentionProperty {
  propertyId: string;
  name: string;
  type: string;
  location: string;
  status: string;
  complianceScore: number | null;
  riskLevel: 'Low' | 'Medium' | 'High';
  reasons: string[];
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface PropertyRanking {
  rank: number;
  propertyId: string;
  name: string;
  type: string;
  location: string;
  status: string;
  complianceScore: number;
  successRate: number;
  marketReadinessScore: number;
  riskLevel: RiskLevel;
}

export interface PropertyRankingsResult {
  rankings: PropertyRanking[];
  unauditedCount: number;
}

export interface BuyerIntelligence {
  budgetDistribution: ChartPoint[];
  preferredTypes: ChartPoint[];
  preferredLocations: ChartPoint[];
  averageBudget: number;
  totalBuyersWithPreferences: number;
}

export interface SalesMonthPoint {
  month: string;
  total: number;
}

export interface SalesPerformance {
  monthlyTrend: SalesMonthPoint[];
  totalRevenue: number;
  monthlyAverage: number;
  forecastNextMonth: number;
  isApproximate: boolean;
  note: string;
  revenueYTD: number;
  revenueYTDSource: string;
}

export interface PortfolioSnapshot {
  summary: DashboardSummary;
  riskCounts: { High: number; Medium: number; Low: number; NotAudited: number };
  buyerIntelligence: {
    topPreferredType: string | null;
    topPreferredLocation: string | null;
    averageBudget: number;
    totalBuyersWithPreferences: number;
  };
  salesPerformance: SalesPerformance;
}

export interface PortfolioInsights {
  portfolioHealth: string;
  marketTrends: string;
  buyerBehavior: string;
  topPerformingCategories: string;
  risks: string;
  recommendations: string;
}

export interface PortfolioInsightsResult {
  snapshot: PortfolioSnapshot;
  insights: PortfolioInsights;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = (await apiRequest(
    '/analytics/dashboard'
  )) as ApiEnvelope<DashboardSummary>;
  return response.data;
}

export async function getChartData(): Promise<ChartData> {
  const response = (await apiRequest('/analytics/charts')) as ApiEnvelope<ChartData>;
  return response.data;
}

export async function getTopProperties(limit = 5): Promise<TopProperty[]> {
  const response = (await apiRequest(
    `/analytics/top-properties?limit=${limit}`
  )) as ApiEnvelope<TopProperty[]>;
  return response.data;
}

export async function getAttentionProperties(): Promise<AttentionProperty[]> {
  const response = (await apiRequest(
    '/analytics/attention-properties'
  )) as ApiEnvelope<AttentionProperty[]>;
  return response.data;
}

export async function getPropertyRankings(): Promise<PropertyRankingsResult> {
  const response = (await apiRequest(
    '/analytics/rankings'
  )) as ApiEnvelope<PropertyRankingsResult>;
  return response.data;
}

export async function getBuyerIntelligence(): Promise<BuyerIntelligence> {
  const response = (await apiRequest(
    '/analytics/buyer-intelligence'
  )) as ApiEnvelope<BuyerIntelligence>;
  return response.data;
}

export async function getSalesPerformance(): Promise<SalesPerformance> {
  const response = (await apiRequest(
    '/analytics/sales-performance'
  )) as ApiEnvelope<SalesPerformance>;
  return response.data;
}

export type RecentActivityType =
  | 'buyer_registered'
  | 'property_added'
  | 'transaction_created'
  | 'transaction_status_changed'
  | 'transaction_completed';

export interface RecentActivityItem {
  type: RecentActivityType;
  title: string;
  description: string;
  timestamp: string;
}

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const response = (await apiRequest('/analytics/activity')) as ApiEnvelope<RecentActivityItem[]>;
  return response.data;
}


export async function generatePortfolioInsights(): Promise<PortfolioInsightsResult> {
  const response = (await apiRequest('/analytics/portfolio-insights', {
    method: 'POST',
  })) as ApiEnvelope<PortfolioInsightsResult>;
  return response.data;
}

export interface TrendingType {
  type: string;
  percentage: number;
}

export interface TopTrendingListing {
  rank: number;
  propertyId: string;
  name: string;
  type: string;
  location: string;
  status: string;
  marketScore: number;
}

export interface BuyerMarketTrends {
  trendingTypes: TrendingType[];
  topListings: TopTrendingListing[];
  totalBuyersWithPreferences: number;
}

export interface BuyerMarketInsight {
  buyerDemand: string;
  topListings: string;
  marketContext: string;
}

export interface BuyerMarketInsightResult {
  snapshot: {
    totalProperties: number;
    availableProperties: number;
    totalBuyersWithPreferences: number;
    averageBudget: number;
    topPreferredLocation: string | null;
    trendingTypes: TrendingType[];
    topListings: TopTrendingListing[];
  };
  insight: BuyerMarketInsight;
}

export async function getBuyerMarketTrends(limit = 5): Promise<BuyerMarketTrends> {
  const response = (await apiRequest(
    `/analytics/buyer/market-trends?limit=${limit}`
  )) as ApiEnvelope<BuyerMarketTrends>;
  return response.data;
}

export async function generateBuyerMarketInsight(): Promise<BuyerMarketInsightResult> {
  const response = (await apiRequest('/analytics/buyer/market-insight', {
    method: 'POST',
  })) as ApiEnvelope<BuyerMarketInsightResult>;
  return response.data;
}