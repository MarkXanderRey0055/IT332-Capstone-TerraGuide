import { apiRequest } from '../utils/api';

// Same pattern as AnalyticsService/PropertyService — this is the only file
// that knows the admin buyer-management endpoints exist, and everything
// here is admin-only on the backend.

export interface BuyerPreferenceSummary {
  landType: string;
  intendedUse: string;
  budgetMin: number;
  budgetMax: number;
  location: string;
  minLotSize: number;
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

export interface CreateBuyerPayload {
  username: string;
  email: string;
  password: string;
  fullName: string;
  address: string;
  // Preference fields are optional — an admin can register an account
  // without setting preferences on the buyer's behalf.
  landType?: string;
  intendedUse?: string;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  minLotSize?: number;
}

export interface UpdateBuyerPayload {
  fullName?: string;
  email?: string;
  address?: string;
  landType?: string;
  intendedUse?: string;
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
  minLotSize?: number;
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

export async function createBuyer(payload: CreateBuyerPayload): Promise<AdminBuyerProfile> {
  const response = (await apiRequest('/admin/buyers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<AdminBuyerProfile>;
  return response.data;
}

export async function updateBuyer(
  userId: string,
  payload: UpdateBuyerPayload
): Promise<AdminBuyerProfile> {
  const response = (await apiRequest(`/admin/buyers/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<AdminBuyerProfile>;
  return response.data;
}

export async function deleteBuyer(userId: string): Promise<void> {
  await apiRequest(`/admin/buyers/${userId}`, { method: 'DELETE' });
}