import { apiRequest } from '../utils/api';

// Same pattern as AdminBuyerService/CabinetService — this is the only file
// that knows the transaction endpoints exist, and everything here is
// admin-only on the backend.

export const TRANSACTION_STATUSES = ['Reserved', 'Processing', 'Completed', 'Cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export interface TransactionBuyer {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

export interface TransactionProperty {
  id: string;
  name: string;
  location: string;
  type: string;
  status: string;
  price: number;
}

export interface Transaction {
  id: string;
  reference: string;
  buyerId: TransactionBuyer | null;
  propertyId: TransactionProperty | null;
  amount: number;
  status: TransactionStatus;
  notes: string;
  createdAt: string;
  completedAt: string | null;
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

export async function getPendingTransactionCount(): Promise<number> {
  const response = (await apiRequest('/transactions/stats/pending')) as ApiEnvelope<{ pendingCount: number }>;
  return response.data.pendingCount;
}
