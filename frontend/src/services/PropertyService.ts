import type { Property } from '../types/types';
import { apiRequest } from '../utils/api';

// This is the same idea as AuthService and buyerPrefs — instead of the
// old mockProperties array + propertyStorage.ts localStorage combo, we're
// now just hitting the real /api/properties endpoints. GET is public (any
// buyer can browse without logging in), but create/update/delete require
// an admin token, which api.ts already attaches automatically.

// Shape of a single property document coming back from the backend.
// Mongoose gives us both `_id` and a virtual `id` (same value, just a
// hex string), plus timestamps we don't really need on the frontend.
export interface PropertyApiRecord {
  id: string;
  _id?: string;
  name: string;
  title?: string;
  owner?: string;
  description?: string;
  type: string;
  location: string;
  price: number;
  size?: number;
  lotSize?: number;
  status: 'Available' | 'Reserved' | 'Sold';
  pricePerSqm?: number;
  lat: number;
  lng: number;
  images?: string[];
  documents?: {
    tax: 'pending' | 'verified' | 'missing';
    deed: 'pending' | 'verified' | 'missing';
    survey: 'pending' | 'verified' | 'missing';
  };
  createdAt?: string;
  updatedAt?: string;
}

interface PropertyListResponse {
  success: boolean;
  message: string;
  data: {
    properties: PropertyApiRecord[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

interface PropertySingleResponse {
  success: boolean;
  message: string;
  data: PropertyApiRecord;
}

// Turns whatever Mongoose hands back into the plain Property shape the
// rest of the app already knows how to work with, so nothing downstream
// has to care that this came from MongoDB instead of the old mock array.
export function mapToProperty(raw: PropertyApiRecord): Property {
  return {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    owner: raw.owner,
    description: raw.description,
    type: raw.type as Property['type'],
    location: raw.location,
    price: raw.price,
    size: raw.size,
    lotSize: raw.lotSize,
    status: raw.status,
    pricePerSqm: raw.pricePerSqm,
    lat: raw.lat,
    lng: raw.lng,
    images: raw.images ?? [],
    documents: raw.documents,
  };
}

/**
 * Grabs every property from the backend.
 *
 * The backend actually supports server-side filtering, sorting, and
 * pagination (search/location/type/status/price range/etc), but the
 * Buyer Portal already does all of that filtering itself once it has
 * the full list in memory — so instead of wiring up query params here,
 * we just ask for a big limit and pull everything in one shot. That way
 * the existing PropertyExplorer/search/sort logic keeps working exactly
 * like it did against the old mock array, no rewrite needed there.
 */
export async function getProperties(): Promise<Property[]> {
  const response = (await apiRequest(
    '/properties?limit=1000'
  )) as PropertyListResponse;

  return response.data.properties.map(mapToProperty);
}

/**
 * Fetch one property by its Mongo id. Not really used yet since the
 * portal keeps the full list in memory, but it's here for when a
 * property detail page wants to load fresh instead of relying on
 * whatever's already in state.
 */
export async function getPropertyById(id: string): Promise<Property> {
  const response = (await apiRequest(
    `/properties/${id}`
  )) as PropertySingleResponse;

  return mapToProperty(response.data);
}

/**
 * Admin-only. Creates a new listing. The backend assigns the real id —
 * we just hand it the form data (minus id, since there isn't one yet).
 */
export async function createProperty(
  data: Omit<Property, 'id'>
): Promise<Property> {
  const response = (await apiRequest('/properties', {
    method: 'POST',
    body: JSON.stringify(data),
  })) as PropertySingleResponse;

  return mapToProperty(response.data);
}

/**
 * Admin-only. Updates an existing listing by id.
 */
export async function updateProperty(
  id: string,
  data: Omit<Property, 'id'>
): Promise<Property> {
  const response = (await apiRequest(`/properties/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })) as PropertySingleResponse;

  return mapToProperty(response.data);
}

/**
 * Admin-only. Deletes a listing for good — there's no "soft delete"
 * on the backend, so once this succeeds the property is just gone.
 */
export async function deleteProperty(id: string): Promise<void> {
  await apiRequest(`/properties/${id}`, { method: 'DELETE' });
}