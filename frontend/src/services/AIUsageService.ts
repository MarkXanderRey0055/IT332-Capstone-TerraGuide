import { apiRequest } from '../utils/api';

// This card only ever displays what the backend reports — there is no
// client-side counter anywhere in this file, on purpose. See Phase 10's
// aiUsageService.js on the backend for the actual enforcement.

export interface AIUsageStatus {
  daily: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  rpm: {
    current: number;
    limit: number;
  };
  breakdown: {
    compliance: number;
    portfolio: number;
    market: number;
  };
  resetAt: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getAiUsageStatus(): Promise<AIUsageStatus> {
  const response = (await apiRequest('/ai/usage')) as ApiEnvelope<AIUsageStatus>;
  return response.data;
}
