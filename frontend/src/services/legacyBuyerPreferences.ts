import type { BuyerPreferences } from '../types/types';

/**
 * LEGACY / DEMO-ONLY MODULE — Admin dashboard use only.
 *
 * The real buyer-facing preference flow (WelcomeModal, BuyerPortal's
 * "Preferences" tab) now goes through the backend via services/buyerPrefs.ts
 * (POST/GET/DELETE /api/preferences), which only ever operates on the
 * *currently authenticated* user's own preferences — the backend has no
 * endpoint for an admin to read or delete an arbitrary buyer's preferences
 * by id.
 *
 * pages/Admin/AdminBuyers.tsx still needs to show a "has this buyer set
 * preferences?" summary across ALL buyers for its demo stats/detail view,
 * which isn't possible with the current backend. This module preserves the
 * old localStorage-based store so that admin view keeps working, but note:
 * it is no longer written to by the real buyer flow, so it will not reflect
 * actual backend data. Once a real `GET /api/admin/buyer-preferences` (or
 * similar) endpoint exists, AdminBuyers.tsx should be switched to that and
 * this file deleted.
 */

const PREFS_STORAGE_KEY = 'terraguide_buyerPreferences';

export function loadAllBuyerPreferences(): BuyerPreferences[] {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BuyerPreferences[];
  } catch {
    return [];
  }
}

export function loadBuyerPreferencesLegacy(userId: string): BuyerPreferences | null {
  if (!userId) return null;
  return loadAllBuyerPreferences().find((pref) => pref.userId === userId) ?? null;
}

export function removeBuyerPreferencesLegacy(userId: string): void {
  const existing = loadAllBuyerPreferences().filter((pref) => pref.userId !== userId);
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(existing));
}