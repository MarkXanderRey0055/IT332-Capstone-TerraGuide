import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isBuyerVisibleStatus } from '../shared/propertyVisibility.mjs';

const explorerSource = await readFile(new URL('./src/components/Shared/PropertyExplorer.tsx', import.meta.url), 'utf8');
assert.equal(isBuyerVisibleStatus('Available'), true);
assert.equal(isBuyerVisibleStatus('Reserved'), false);
assert.equal(isBuyerVisibleStatus('Sold'), false);
assert.match(explorerSource, /const filteredProperties = properties\.filter/);
assert.match(explorerSource, /filteredProperties\.map\(\(property\)/, 'Explorer list uses the filtered collection');
assert.match(explorerSource, /filteredProperties\.filter\(\(p\) => hasValidCoords/,
  'Explorer map markers use the exact same filtered collection as the list');

console.log('Buyer Explorer visibility check passed (list and markers share the Available-only filtered collection).');
