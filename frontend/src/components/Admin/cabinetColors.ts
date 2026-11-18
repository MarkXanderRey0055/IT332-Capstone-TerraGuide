import type { CabinetColor } from '../../services/CabinetService';

// One muted accent token per admin-selectable cabinet identity. Cabinet
// accents are intentionally limited to dots, icons, and small labels.
export interface CabinetColorStyle {
  label: string;
  accent: string;
}

export const CABINET_COLOR_STYLES: Record<CabinetColor, CabinetColorStyle> = {
  green: {
    label: 'Green',
    accent: 'var(--color-cabinet-accent-1)',
  },
  blue: {
    label: 'Blue',
    accent: 'var(--color-cabinet-accent-2)',
  },
  orange: {
    label: 'Orange',
    accent: 'var(--color-cabinet-accent-3)',
  },
  purple: {
    label: 'Purple',
    accent: 'var(--color-cabinet-accent-4)',
  },
  red: {
    label: 'Red',
    accent: 'var(--color-cabinet-accent-5)',
  },
  gray: {
    label: 'Gray',
    accent: 'var(--color-cabinet-accent-6)',
  },
};
