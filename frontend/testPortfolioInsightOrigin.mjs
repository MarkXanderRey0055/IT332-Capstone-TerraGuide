import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./src/pages/Admin/AdminAnalytics.tsx', import.meta.url), 'utf8');
assert.match(source, /AI-generated/);
assert.match(source, /System-generated \(AI unavailable\)/);
assert.match(source, /AI_TIMEOUT/);
assert.match(source, /AI_INVALID_RESPONSE/);
assert.match(source, /The AI service was unavailable; this summary is based on current portfolio data\./);
console.log('Portfolio Insights origin and fallback-reason UI checks passed.');
