import type { CabinetColor } from '../../services/CabinetService';

// One style bundle per admin-selectable color — used for cabinet headers,
// accent borders, folder tab indicators, and small badges. Kept separate
// from the components so the same palette stays consistent everywhere a
// cabinet's color shows up (the panel, the properties table, badges).
export interface CabinetColorStyle {
  label: string;
  header: string; // header background wash
  border: string; // accent border
  text: string; // accent text color
  handle: string; // "drawer handle" bar color
  badgeBg: string;
  badgeText: string;
}

export const CABINET_COLOR_STYLES: Record<CabinetColor, CabinetColorStyle> = {
  green: {
    label: 'Green',
    header: 'rgba(16,122,74,0.08)',
    border: 'rgba(16,122,74,0.35)',
    text: '#0f6b45',
    handle: '#2f8f5e',
    badgeBg: 'rgba(16,122,74,0.12)',
    badgeText: '#0f6b45',
  },
  blue: {
    label: 'Blue',
    header: 'rgba(37,99,180,0.08)',
    border: 'rgba(37,99,180,0.35)',
    text: '#2a5c9a',
    handle: '#3f74b8',
    badgeBg: 'rgba(37,99,180,0.12)',
    badgeText: '#2a5c9a',
  },
  orange: {
    label: 'Orange',
    header: 'rgba(191,110,20,0.09)',
    border: 'rgba(191,110,20,0.35)',
    text: '#a15b12',
    handle: '#c47a2e',
    badgeBg: 'rgba(191,110,20,0.13)',
    badgeText: '#a15b12',
  },
  purple: {
    label: 'Purple',
    header: 'rgba(120,75,170,0.09)',
    border: 'rgba(120,75,170,0.35)',
    text: '#6a4394',
    handle: '#8863ac',
    badgeBg: 'rgba(120,75,170,0.13)',
    badgeText: '#6a4394',
  },
  red: {
    label: 'Red',
    header: 'rgba(178,52,52,0.08)',
    border: 'rgba(178,52,52,0.35)',
    text: '#a13636',
    handle: '#c04c4c',
    badgeBg: 'rgba(178,52,52,0.12)',
    badgeText: '#a13636',
  },
  gray: {
    label: 'Gray',
    header: 'rgba(90,80,68,0.08)',
    border: 'rgba(90,80,68,0.3)',
    text: '#5d503f',
    handle: '#7c6a57',
    badgeBg: 'rgba(90,80,68,0.12)',
    badgeText: '#5d503f',
  },
};
