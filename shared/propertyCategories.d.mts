export declare const RESIDENTIAL_SUBTYPES: readonly ['Residential', 'House & Lot', 'Condominium'];

export declare function isResidentialSubtype(type: string | null | undefined): boolean;

export declare function expandBuyerPropertyTypeFilter(
  type: string | null | undefined
): string[] | null;
