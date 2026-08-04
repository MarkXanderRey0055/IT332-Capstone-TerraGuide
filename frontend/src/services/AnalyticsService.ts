import { apiRequest } from '../utils/api';

// Same pattern as PropertyService/AuditService — this is the only file
// that knows the analytics endpoints exist. All four are admin-only on
// the backend.

export interface DashboardSummary {
  totalProperties: number;
  availableProperties: number;
  reservedProperties: number;
  soldProperties: number;
  totalBuyers: number;
  averageComplianceScore: number;
  averageSuccessRate: number;
  estimatedPortfolioValue: number;
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
  reasons: string[];
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