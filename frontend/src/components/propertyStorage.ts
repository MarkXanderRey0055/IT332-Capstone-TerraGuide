import type { Property } from './types';

const STORAGE_KEY = 'terraguide_properties';

export function loadProperties(defaults: Property[]): Property[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as Property[];
    }
  } catch {
    // fall through to defaults
  }
  return defaults;
}

export function saveProperties(properties: Property[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
}
