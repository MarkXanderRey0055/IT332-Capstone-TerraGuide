import assert from 'node:assert/strict';
import analyticsRouter from './src/routes/analyticsRoutes.js';
import * as analyticsService from './src/services/analyticsService.js';
import * as aiService from './src/services/aiService.js';

const routes = analyticsRouter.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]),
  }));

const hasRemovedPostRoute = routes.some(
  (route) => route.path === '/buyer/market-insight' && route.methods.includes('post')
);
assert.equal(hasRemovedPostRoute, false, 'POST /buyer/market-insight must be removed');

const hasMarketTrendsRoute = routes.some(
  (route) => route.path === '/buyer/market-trends' && route.methods.includes('get')
);
assert.equal(hasMarketTrendsRoute, true, 'GET /buyer/market-trends must remain registered');

const hasSearchMetricsRoute = routes.some(
  (route) => route.path === '/buyer/search-metrics' && route.methods.includes('get')
);
assert.equal(hasSearchMetricsRoute, true, 'GET /buyer/search-metrics must remain registered');

assert.equal(
  'generateBuyerMarketInsight' in analyticsService,
  false,
  'analyticsService must not export generateBuyerMarketInsight'
);
assert.equal(
  'generateBuyerMarketNarrative' in aiService,
  false,
  'aiService must not export generateBuyerMarketNarrative'
);

console.log('Buyer market insight removal tests passed: POST route and service exports removed; market-trends and search-metrics remain.');
