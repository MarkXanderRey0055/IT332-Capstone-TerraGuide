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
  contactNumber?: string | null;
  address: string;
  profilePictureUrl?: string | null;
  registeredAt: string;
  preferences: BuyerPreferenceSummary | null;
}

export interface AdminBuyerRelatedProperty {
  id: string;
  name: string | null;
  location: string | null;
  type: string | null;
  status: string | null;
  price: number | null;
}

export interface AdminBuyerInquiryRecord {
  id: string;
  property: AdminBuyerRelatedProperty | null;
  status: string;
  message: string;
  createdAt: string;
}

export interface AdminBuyerSiteVisitRecord {
  id: string;
  property: AdminBuyerRelatedProperty | null;
  preferredDate: string;
  preferredTime: string;
  status: string;
  notes: string;
  createdAt: string;
}

export interface AdminBuyerTransactionRecord {
  id: string;
  reference: string;
  property: AdminBuyerRelatedProperty | null;
  amount: number | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminBuyerDetails extends AdminBuyerProfile {
  inquiries: AdminBuyerInquiryRecord[];
  siteVisits: AdminBuyerSiteVisitRecord[];
  transactions: AdminBuyerTransactionRecord[];
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

export async function getBuyerDetails(userId: string): Promise<AdminBuyerDetails> {
  const response = (await apiRequest(
    `/admin/buyers/${encodeURIComponent(userId)}/details`
  )) as ApiEnvelope<AdminBuyerDetails>;
  return response.data;
}
