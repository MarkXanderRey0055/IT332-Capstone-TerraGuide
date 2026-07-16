import type { BuyerPreferences } from '../types/types';

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

export function loadBuyerPreferences(userId: string): BuyerPreferences | null {
  if (!userId) return null;
  return loadAllBuyerPreferences().find((pref) => pref.userId === userId) ?? null;
}

export function saveBuyerPreferences(prefs: BuyerPreferences): void {
  const existing = loadAllBuyerPreferences().filter((pref) => pref.userId !== prefs.userId);
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify([...existing, prefs]));
}

export function removeBuyerPreferences(userId: string): void {
  const existing = loadAllBuyerPreferences().filter((pref) => pref.userId !== userId);
  window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(existing));
}

export function getLotSize(property: { size?: number; lotSize?: number }) {
  return property.size ?? property.lotSize ?? 0;
}

export function getPropertyLabel(property: { name: string; title?: string }) {
  return property.title ?? property.name;
}
