import type { Property } from '../types/types';
import { apiRequest, ApiError } from '../utils/api';
import { mapToProperty, type PropertyApiRecord } from './PropertyService';

// This one's the same idea as the others — GET /api/recommendations does
// all the actual matching server-side now (reads the buyer's saved
// preferences, filters properties by budget/type/location/lot size,
// only returns Available ones). The frontend used to run its own scoring
// function for this (see the old BuyerSuggestions component), but that's
// gone now — we just show whatever the backend hands back.

interface RecommendationApiResponse {
  success: boolean;
  message: string;
  data: {
    preferences: Record<string, unknown>;
    totalMatches: number;
    properties: PropertyApiRecord[];
  };
}

export interface RecommendationResult {
  properties: Property[];
  totalMatches: number;
  // false when the buyer hasn't saved any preferences yet — the backend
  // 404s in that case, which isn't really an "error" so much as "there's
  // nothing to recommend from yet". Same treatment as loadBuyerPreferences.
  hasPreferences: boolean;
}

/**
 * Fetches the logged-in buyer's recommended properties from the backend.
 * No params needed — the backend figures out who's asking from the JWT
 * and pulls their saved preferences itself.
 */
export async function getRecommendations(): Promise<RecommendationResult> {
  try {
    const response = (await apiRequest(
      '/recommendations'
    )) as RecommendationApiResponse;

    return {
      properties: response.data.properties.map(mapToProperty),
      totalMatches: response.data.totalMatches,
      hasPreferences: true,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { properties: [], totalMatches: 0, hasPreferences: false };
    }
    throw error;
  }
}