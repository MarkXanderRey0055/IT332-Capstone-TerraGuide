import { apiRequest } from '../utils/api';

export type AuditFreshnessStatus = 'CURRENT' | 'STALE' | 'UNKNOWN';
export type AuditNarrativeOrigin = 'AI_GENERATED' | 'SYSTEM_FALLBACK';
export type AuditNarrativeFallbackReason =
  | 'AI_UNAVAILABLE'
  | 'AI_INVALID_RESPONSE'
  | 'AI_CONTRADICTORY_RESPONSE';

export interface AuditStaleReason {
  field: string;
  label: string;
  previousValue?: unknown;
  currentValue?: unknown;
}

export interface Audit {
  id: string;
  propertyId: string;
  generatedAt: string;
  model: string;
  methodologyVersion?: string | null;
  documentWeights?: { deed?: number; tax?: number; survey?: number };
  documentStatuses?: {
    deed?: 'pending' | 'verified' | 'missing';
    tax?: 'pending' | 'verified' | 'missing';
    survey?: 'pending' | 'verified' | 'missing';
  };
  documentCompleteness?: number;
  complianceScore: number;
  estimatedSuccessRate: number;
  potentialSuccessRate: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  verifiedDocuments: number;
  totalDocuments: number;
  missingItems: string[];
  pendingItems?: string[];
  unknownStatuses?: Array<{ document: string; receivedStatus: string | null }>;
  summary: string;
  recommendation: string;
  narrativeOrigin?: AuditNarrativeOrigin | null;
  narrativeFallbackReason?: AuditNarrativeFallbackReason | null;
  createdBy: string;
  freshnessStatus?: AuditFreshnessStatus;
  isStale?: boolean;
  staleReasons?: AuditStaleReason[];
  snapshotAvailable?: boolean;
}

interface AuditApiResponse {
  success: boolean;
  message: string;
  data: Audit;
}

export async function generateAudit(propertyId: string): Promise<Audit> {
  const response = (await apiRequest('/audits/generate', {
    method: 'POST',
    body: JSON.stringify({ propertyId }),
  })) as AuditApiResponse;

  return response.data;
}

export async function getAuditHistory(propertyId: string): Promise<Audit[]> {
  const response = (await apiRequest(`/audits/${propertyId}`)) as {
    success: boolean;
    data: Audit[];
  };

  return response.data;
}
