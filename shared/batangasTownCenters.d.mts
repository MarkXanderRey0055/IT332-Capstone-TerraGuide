export interface BatangasTownCenter {
  name: string;
  aliases?: string[];
  center: [number, number];
}

export const BATANGAS_TOWN_CENTERS: BatangasTownCenter[];
export function normalizeBatangasLocationWords(value: string): string;
export function findBatangasTown(location: string): BatangasTownCenter | undefined;
