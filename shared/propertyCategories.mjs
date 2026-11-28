export const RESIDENTIAL_SUBTYPES = ['Residential', 'House & Lot', 'Condominium'];

export const isResidentialSubtype = (type) =>
  RESIDENTIAL_SUBTYPES.includes(type);

export const expandBuyerPropertyTypeFilter = (type) => {
  if (!type) return null;
  if (type === 'Residential') return [...RESIDENTIAL_SUBTYPES];
  return [type];
};
