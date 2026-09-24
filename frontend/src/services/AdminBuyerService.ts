import { apiRequest } from '../utils/api';

// Same pattern as AnalyticsService/PropertyService — this is the only file
// that knows the admin buyer-management endpoints exist, and everything
// here is admin-only on the backend.

export interface BuyerPreferenceSummary {
  landType: string | null;
  intendedUse: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  location: string | null;
  minLotSize: number | null;
  updatedAt: string;
}

export interface AdminBuyerProfile {
  userId: string;
  fullName: string;
  username: string;
  email: string;
  address: string;
  registeredAt: string;
  preferences: BuyerPreferenceSummary | null;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getBuyers(search = ''): Promise<AdminBuyerProfile[]> {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  const response = (await apiRequest(`/admin/buyers${query}`)) as ApiEnvelope<AdminBuyerProfile[]>;
  return response.data;
}
