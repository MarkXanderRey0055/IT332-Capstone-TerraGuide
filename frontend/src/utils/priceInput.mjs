export function formatPriceInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPriceInputChange(value, caretPosition) {
  const caret = Math.max(0, Math.min(caretPosition, value.length));
  const digitsBeforeCaret = value.slice(0, caret).replace(/\D/g, '').length;
  const digits = value.replace(/\D/g, '');
  const displayValue = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let nextCaret = 0;
  let digitsSeen = 0;
  while (nextCaret < displayValue.length && digitsSeen < digitsBeforeCaret) {
    if (/\d/.test(displayValue[nextCaret])) digitsSeen += 1;
    nextCaret += 1;
  }

  return {
    displayValue,
    numericValue: digits ? Number(digits) : '',
    caretPosition: nextCaret,
  };
}

export function optionalPriceBound(value) {
  return value || undefined;
}

export function appendPriceBounds(params, minPrice, maxPrice) {
  if (minPrice !== undefined) params.set('minPrice', String(minPrice));
  if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
}
