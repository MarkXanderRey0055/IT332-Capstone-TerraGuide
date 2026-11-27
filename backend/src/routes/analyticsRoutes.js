import express from 'express';
import {
  getDashboardSummary,
  getChartData,
  getTopProperties,
  getAttentionProperties,
  getPropertyRankings,
  getBuyerIntelligence,
  getSalesPerformance,
  getTypeDecisions,
  generatePortfolioInsights,
  getBuyerMarketTrends,
  getBuyerSearchMetrics,
  getRecentActivity,
} from '../controllers/AnalyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getDashboardSummary);
router.get('/charts', protect, authorize('admin'), getChartData);
router.get('/top-properties', protect, authorize('admin'), getTopProperties);
router.get('/attention-properties', protect, authorize('admin'), getAttentionProperties);
router.get('/rankings', protect, authorize('admin'), getPropertyRankings);
router.get('/buyer-intelligence', protect, authorize('admin'), getBuyerIntelligence);
router.get('/sales-performance', protect, authorize('admin'), getSalesPerformance);
router.get('/activity', protect, authorize('admin'), getRecentActivity);
router.get('/type-decisions', protect, authorize('admin'), getTypeDecisions);
router.post('/portfolio-insights', protect, authorize('admin'), generatePortfolioInsights);
router.get('/buyer/market-trends', protect, authorize('buyer'), getBuyerMarketTrends);
router.get('/buyer/search-metrics', getBuyerSearchMetrics);

export default router;
