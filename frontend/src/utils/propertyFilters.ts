import type { Property } from '../types/types';

export type AggregateDocumentStatus = 'Verified' | 'Pending' | 'Missing';
export type PropertySort = 'latest' | 'priceAsc' | 'priceDesc';

/** Keep aggregate filtering aligned with the Admin table's pending fallback. */
export function getAggregateDocumentStatus(property: Property): AggregateDocumentStatus {
  const statuses = [
    property.documents?.deed ?? 'pending',
    property.documents?.tax ?? 'pending',
    property.documents?.survey ?? 'pending',
  ];

  if (statuses.includes('missing')) return 'Missing';
  if (statuses.includes('pending')) return 'Pending';
  return 'Verified';
}

export function filterAndSortProperties(
  properties: Property[],
  filters: {
    search?: string;
    type?: string;
    location?: string;
    documentStatus?: AggregateDocumentStatus | '';
    status?: Property['status'] | '';
    sort?: PropertySort;
  },
): Property[] {
  const query = filters.search?.trim().toLowerCase() ?? '';
  const result = properties.filter((property) => {
    const matchesSearch = !query || [property.name, property.owner ?? '', property.location]
      .some((value) => value.toLowerCase().includes(query));
    return matchesSearch
      && (!filters.type || property.type === filters.type)
      && (!filters.location || property.location === filters.location)
      && (!filters.documentStatus || getAggregateDocumentStatus(property) === filters.documentStatus)
      && (!filters.status || property.status === filters.status);
  });

  switch (filters.sort) {
    case 'priceAsc':
      result.sort((a, b) => a.price - b.price);
      break;
    case 'priceDesc':
      result.sort((a, b) => b.price - a.price);
      break;
    default:
      result.sort((a, b) => {
        const aDate = Date.parse(a.createdAt ?? '');
        const bDate = Date.parse(b.createdAt ?? '');
        return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
      });
  }
  return result;
}

export function getPropertyFilterOptions(properties: Property[]) {
  return {
    types: [...new Set(properties.map((property) => property.type).filter(Boolean))].sort(),
    locations: [...new Set(properties.map((property) => property.location).filter(Boolean))].sort(),
  };
}
