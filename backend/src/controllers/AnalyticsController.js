import * as analyticsService from '../services/analyticsService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();

  return sendSuccess(res, 200, 'Dashboard summary retrieved successfully.', summary);
});

export const getChartData = asyncHandler(async (req, res) => {
  const charts = await analyticsService.getChartData();

  return sendSuccess(res, 200, 'Chart data retrieved successfully.', charts);
});

export const getTopProperties = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;

  const topProperties = await analyticsService.getTopProperties(limit);

  return sendSuccess(res, 200, 'Top properties retrieved successfully.', topProperties);
});


export const getAttentionProperties = asyncHandler(async (req, res) => {
  const attentionProperties = await analyticsService.getAttentionProperties();

  return sendSuccess(
    res,
    200,
    'Attention properties retrieved successfully.',
    attentionProperties
  );
});

export const getPropertyRankings = asyncHandler(async (req, res) => {
  const rankings = await analyticsService.getPropertyRankings();

  return sendSuccess(res, 200, 'Property rankings retrieved successfully.', rankings);
});

export const getBuyerIntelligence = asyncHandler(async (req, res) => {
  const buyerIntelligence = await analyticsService.getBuyerIntelligence();

  return sendSuccess(
    res,
    200,
    'Buyer intelligence retrieved successfully.',
    buyerIntelligence
  );
});

export const getSalesPerformance = asyncHandler(async (req, res) => {
  const salesPerformance = await analyticsService.getSalesPerformance();

  return sendSuccess(
    res,
    200,
    'Sales performance retrieved successfully.',
    salesPerformance
  );
});


export const generatePortfolioInsights = asyncHandler(async (req, res) => {
  const result = await analyticsService.generatePortfolioInsights();

  return sendSuccess(res, 200, 'Portfolio insights generated successfully.', result);
});

// ============================================================
// BUYER DECISION ANALYTICS (Buyer Home page market intelligence)
// ============================================================


export const getBuyerMarketTrends = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;

  const trends = await analyticsService.getBuyerMarketTrends(limit);

  return sendSuccess(res, 200, 'Buyer market trends retrieved successfully.', trends);
});


export const generateBuyerMarketInsight = asyncHandler(async (req, res) => {
  const result = await analyticsService.generateBuyerMarketInsight();

  return sendSuccess(res, 200, 'Buyer market insight generated successfully.', result);
});