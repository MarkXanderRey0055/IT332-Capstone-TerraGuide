import * as analyticsService from '../services/analyticsService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// @desc    Get KPI summary numbers for the analytics dashboard
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();

  return sendSuccess(res, 200, 'Dashboard summary retrieved successfully.', summary);
});

// @desc    Get chart-ready datasets for the analytics dashboard
// @route   GET /api/analytics/charts
// @access  Private (Admin)
export const getChartData = asyncHandler(async (req, res) => {
  const charts = await analyticsService.getChartData();

  return sendSuccess(res, 200, 'Chart data retrieved successfully.', charts);
});

// @desc    Get the highest-scoring properties by latest compliance audit
// @route   GET /api/analytics/top-properties
// @access  Private (Admin)
export const getTopProperties = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;

  const topProperties = await analyticsService.getTopProperties(limit);

  return sendSuccess(res, 200, 'Top properties retrieved successfully.', topProperties);
});

// @desc    Get properties that need administrative attention
// @route   GET /api/analytics/attention-properties
// @access  Private (Admin)
export const getAttentionProperties = asyncHandler(async (req, res) => {
  const attentionProperties = await analyticsService.getAttentionProperties();

  return sendSuccess(
    res,
    200,
    'Attention properties retrieved successfully.',
    attentionProperties
  );
});

// @desc    Get the ranked property performance report (compliance,
//          success rate, market readiness, risk level)
// @route   GET /api/analytics/rankings
// @access  Private (Admin)
export const getPropertyRankings = asyncHandler(async (req, res) => {
  const rankings = await analyticsService.getPropertyRankings();

  return sendSuccess(res, 200, 'Property rankings retrieved successfully.', rankings);
});

// @desc    Get buyer preference analytics (budget, preferred types/locations)
// @route   GET /api/analytics/buyer-intelligence
// @access  Private (Admin)
export const getBuyerIntelligence = asyncHandler(async (req, res) => {
  const buyerIntelligence = await analyticsService.getBuyerIntelligence();

  return sendSuccess(
    res,
    200,
    'Buyer intelligence retrieved successfully.',
    buyerIntelligence
  );
});

// @desc    Get sales trend/revenue/forecast (approximate, see response note)
// @route   GET /api/analytics/sales-performance
// @access  Private (Admin)
export const getSalesPerformance = asyncHandler(async (req, res) => {
  const salesPerformance = await analyticsService.getSalesPerformance();

  return sendSuccess(
    res,
    200,
    'Sales performance retrieved successfully.',
    salesPerformance
  );
});

// @desc    Generate the AI Portfolio Insights executive report
// @route   POST /api/analytics/portfolio-insights
// @access  Private (Admin)
export const generatePortfolioInsights = asyncHandler(async (req, res) => {
  const result = await analyticsService.generatePortfolioInsights();

  return sendSuccess(res, 200, 'Portfolio insights generated successfully.', result);
});