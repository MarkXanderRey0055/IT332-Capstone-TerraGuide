import { apiRequest } from '../utils/api';

export const CABINET_COLORS = ['green', 'blue', 'orange', 'purple', 'red', 'gray'] as const;
export type CabinetColor = (typeof CABINET_COLORS)[number];

export interface Cabinet {
  id: string;
  name: string;
  description: string;
  capacity: number;
  color: CabinetColor;
  filedCount: number;
  remainingCapacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetListResult {
  cabinets: Cabinet[];
  unassignedCount: number;
}

export interface CabinetPayload {
  name?: string;
  description?: string;
  capacity?: number;
  color?: CabinetColor;
}

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getCabinets(): Promise<CabinetListResult> {
  const response = (await apiRequest('/cabinets')) as ApiEnvelope<CabinetListResult>;
  return response.data;
}

export async function createCabinet(payload: CabinetPayload): Promise<Cabinet> {
  const response = (await apiRequest('/cabinets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<Cabinet>;
  return response.data;
}

export async function updateCabinet(cabinetId: string, payload: CabinetPayload): Promise<Cabinet> {
  const response = (await apiRequest(`/cabinets/${cabinetId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })) as ApiEnvelope<Cabinet>;
  return response.data;
}

export async function deleteCabinet(cabinetId: string): Promise<void> {
  await apiRequest(`/cabinets/${cabinetId}`, { method: 'DELETE' });
}

/**
 * Files one or more properties into a cabinet. Also how moving a property
 * between cabinets works — call this with the destination cabinet id.
 */
export async function assignPropertiesToCabinet(
  cabinetId: string,
  propertyIds: string[]
): Promise<{ filedCount: number }> {
  const response = (await apiRequest(`/cabinets/${cabinetId}/properties`, {
    method: 'POST',
    body: JSON.stringify({ propertyIds }),
  })) as ApiEnvelope<{ filedCount: number }>;
  return response.data;
}

/**
 * Removes a property from its current cabinet — the property becomes
 * Unassigned, it is never deleted.
 */
export async function removePropertyFromCabinet(propertyId: string): Promise<void> {
  await apiRequest(`/cabinets/properties/${propertyId}`, { method: 'DELETE' });
}
