import type { Property } from '../types/types';

export type PropertyAuditQuickFilter = 'NOT_AUDITED' | 'STALE' | null;

export function filterPropertiesByAuditState(
  properties: Property[],
  selectedState: PropertyAuditQuickFilter
): Property[];
