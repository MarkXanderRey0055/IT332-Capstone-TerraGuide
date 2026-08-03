import { apiRequest } from '../utils/api';

export interface Audit {
  id: string;
  propertyId: string;
  generatedAt: string;
  model: string;
  complianceScore: number;
  estimatedSuccessRate: number;
  potentialSuccessRate: number;
  riskLevel: 'High' | 'Medium' | 'Low';
  verifiedDocuments: number;
  totalDocuments: number;
  missingItems: string[];
  summary: string;
  recommendation: string;
  createdBy: string;
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