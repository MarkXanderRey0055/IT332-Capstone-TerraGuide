export function toPublicProperty(property) {
  if (!property || typeof property !== 'object') {
    return property;
  }

  const plain =
    typeof property.toJSON === 'function'
      ? property.toJSON({ virtuals: true })
      : { ...property };

  const {
    owner: _owner,
    documentVerificationHistory: _documentVerificationHistory,
    verificationRemarks: _verificationRemarks,
    ...publicFields
  } = plain;

  return publicFields;
}

export function toPublicProperties(list) {
  return Array.isArray(list) ? list.map(toPublicProperty) : [];
}
