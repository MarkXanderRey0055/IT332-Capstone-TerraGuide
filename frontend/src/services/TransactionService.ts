import { apiRequest } from '../utils/api';

// Same pattern as AdminBuyerService/CabinetService — this is the only file
// that knows the transaction endpoints exist, and everything here is
// admin-only on the backend.

export const TRANSACTION_STATUSES = ['Reserved', 'Processing', 'Completed', 'Cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface TransactionBuyer {
  id?: string;
  _id?: string;
  fullName?: string;
  username?: string;
  email?: string;
}

export interface TransactionProperty {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  location?: string;
  type?: string;
  status?: string;
  price?: number;
  owner?: string;
  size?: number;
  lotSize?: number;
}

export interface TransactionCreatedBy {
  id?: string;
  _id?: string;
  fullName?: string;
  username?: string;
}

export interface Transaction {
  id: string;
  _id?: string;
  reference: string;
  buyerId: TransactionBuyer | null;
  propertyId: TransactionProperty | null;
  amount: number;
  listingPriceAtCreation?: number | null;
  status: TransactionStatus;
  notes: string;
  createdBy?: TransactionCreatedBy | null;
  createdAt: string;
  updatedAt?: string;
  completedAt: string | null;
  correctionHistory?: TransactionCorrection[];
}

export interface TransactionCorrection {
  id: string;
  reason: string;
  correctedBy?: { id?: string; _id?: string; fullName?: string; username?: string } | null;
  correctedAt: string;
  original: { amount: number; notes: string };
  revised: { amount: number; notes: string };
}

export interface CreateTransactionPayload {
  buyerId: string;
  propertyId: string;
  amount: number;
  notes?: string;
}

export interface UpdateTransactionPayload {
  amount?: number;
  notes?: string;
  status?: TransactionStatus;
  buyerId?: string;
  propertyId?: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface TransactionFilters {
  status?: TransactionStatus;
  buyerId?: string;
  propertyId?: string;
  search?: string;
}

function buildQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.buyerId) params.set('buyerId', filters.buyerId);
  if (filters.propertyId) params.set('propertyId', filters.propertyId);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  const response = (await apiRequest(`/transactions${buildQuery(filters)}`)) as ApiEnvelope<Transaction[]>;
  return response.data;
}

export async function getTransactionById(id: string): Promise<Transaction> {
  const response = (await apiRequest(`/transactions/${id}`)) as ApiEnvelope<Transaction>;
  return response.data;
}

export async function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const response = (await apiRequest('/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<Transaction>;
  return response.data;
}

export async function updateTransaction(id: string, payload: UpdateTransactionPayload): Promise<Transaction> {
  const response = (await apiRequest(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<Transaction>;
  return response.data;
}

export async function correctTransaction(
  id: string,
  payload: { amount: number; notes: string; reason: string }
): Promise<Transaction> {
  const response = (await apiRequest(`/transactions/${id}/correct`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<Transaction>;
  return response.data;
}

export async function getPendingTransactionCount(): Promise<number> {
  const response = (await apiRequest('/transactions/stats/pending')) as ApiEnvelope<{ pendingCount: number }>;
  return response.data.pendingCount;
}
