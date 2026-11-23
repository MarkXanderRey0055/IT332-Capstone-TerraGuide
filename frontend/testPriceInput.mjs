import assert from 'node:assert/strict';
import {
  appendPriceBounds,
  formatPriceInput,
  formatPriceInputChange,
  optionalPriceBound,
} from './src/utils/priceInput.mjs';

const change = formatPriceInputChange('1500000', 7);
assert.equal(change.displayValue, '1,500,000');
assert.equal(change.numericValue, 1500000);
assert.equal(formatPriceInput(change.numericValue), '1,500,000');

const requestQuery = new URLSearchParams();
appendPriceBounds(requestQuery, optionalPriceBound(change.numericValue));
assert.equal(requestQuery.get('minPrice'), '1500000', 'request uses an unformatted numeric bound');
assert.equal(formatPriceInput(0 || ''), '', 'zero retains the existing empty display behavior');
assert.equal(optionalPriceBound(0), undefined, 'zero retains the existing no-bound request behavior');

const cleared = formatPriceInputChange('', 0).numericValue;
assert.equal(cleared, '');
assert.equal(optionalPriceBound(cleared), undefined, 'clearing removes the bound');
const clearedQuery = new URLSearchParams();
appendPriceBounds(clearedQuery, optionalPriceBound(cleared));
assert.equal(clearedQuery.has('minPrice'), false, 'a cleared input sends no minPrice parameter');

const middleInsertion = formatPriceInputChange('12,340', 2);
assert.equal(middleInsertion.displayValue, '12,340');
assert.equal(middleInsertion.caretPosition, 2, 'caret follows the digits before its old position');
assert.equal(formatPriceInputChange('1a.5', 4).displayValue, '15', 'non-digit characters are discarded');

console.log('Price input tests passed: comma formatting, numeric request bounds, clearing, digit filtering, and caret mapping.');
