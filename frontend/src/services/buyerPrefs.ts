import type { BuyerPreferences } from '../types/types';
import { apiRequest, ApiError } from '../utils/api';

/**
 * BuyerPreferencesService
 *
 * Backend-backed replacement for the old localStorage preference store.
 * Preferences are now tied to the authenticated user server-side
 * (POST/GET/DELETE /api/preferences, protected by JWT), so there is no
 * userId to pass when reading/writing — the backend derives it from the
 * token. The userId param is kept on these functions only so callers can
 * stamp it onto the returned BuyerPreferences object for local use.
 */

type PreferencePayload = Omit<BuyerPreferences, 'userId' | 'timestamp'>;

interface PreferenceApiResponse {
  success: boolean;
  message: string;
  data: {
    _id: string;
    userId: string;
    budgetMin: number;
    budgetMax: number;
    landType: string;
    intendedUse: string;
    location: string;
    minLotSize: number;
    createdAt?: string;
    updatedAt?: string;
  };
}

function mapToBuyerPreferences(
  raw: PreferenceApiResponse['data'],
  userId: string
): BuyerPreferences {
  return {
    userId,
    budgetMin: raw.budgetMin,
    budgetMax: raw.budgetMax,
    landType: raw.landType,
    intendedUse: raw.intendedUse,
    location: raw.location,
    minLotSize: raw.minLotSize,
    timestamp: raw.updatedAt ? new Date(raw.updatedAt).getTime() : Date.now(),
  };
}

/**
 * Fetch the logged-in buyer's saved preferences from the backend.
 *
 * Returns null if the buyer hasn't set preferences yet (backend responds
 * 404) rather than throwing — "no preferences yet" is an expected state,
 * not an error, and callers use this to decide whether to show the
 * welcome/preferences modal.
 */
export async function loadBuyerPreferences(
  userId: string
): Promise<BuyerPreferences | null> {
  if (!userId) return null;

  try {
    const response = (await apiRequest('/preferences')) as PreferenceApiResponse;
    return mapToBuyerPreferences(response.data, userId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Save (create or update) the logged-in buyer's preferences.
 *
 * The backend upserts on POST /api/preferences (findOneAndUpdate with
 * upsert: true), so the same call handles both "first time" and
 * "editing existing preferences" — no separate PUT/create branch needed.
 */
export async function saveBuyerPreferences(
  userId: string,
  prefsData: PreferencePayload
): Promise<BuyerPreferences> {
  const response = (await apiRequest('/preferences', {
    method: 'POST',
    body: JSON.stringify(prefsData),
  })) as PreferenceApiResponse;

  return mapToBuyerPreferences(response.data, userId);
}

/**
 * Permanently delete the logged-in buyer's saved preferences from the
 * backend (DELETE /api/preferences). Treats "nothing to delete" (404) as
 * a no-op success rather than an error.
 */
export async function removeBuyerPreferences(userId: string): Promise<void> {
  if (!userId) return;

  try {
    await apiRequest('/preferences', { method: 'DELETE' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return;
    }
    throw error;
  }
}

export function getLotSize(property: { size?: number; lotSize?: number }) {
  return property.size ?? property.lotSize ?? 0;
}

export function getPropertyLabel(property: { name: string; title?: string }) {
  return property.title ?? property.name;
}