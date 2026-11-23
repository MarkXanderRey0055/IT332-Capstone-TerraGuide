export function formatPriceInput(value: string | number | null | undefined): string;
export function formatPriceInputChange(value: string, caretPosition: number): {
  displayValue: string;
  numericValue: number | '';
  caretPosition: number;
};
export function optionalPriceBound(value: number | ''): number | undefined;
export function appendPriceBounds(params: URLSearchParams, minPrice?: number, maxPrice?: number): void;
