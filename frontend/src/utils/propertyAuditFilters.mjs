import { isBuyerVisibleStatus } from '../../../shared/propertyVisibility.mjs';

export function filterPropertiesByAuditState(properties, selectedState) {
  if (!selectedState) return properties;
  return properties.filter((property) =>
    isBuyerVisibleStatus(property.status) && property.auditState?.status === selectedState
  );
}
