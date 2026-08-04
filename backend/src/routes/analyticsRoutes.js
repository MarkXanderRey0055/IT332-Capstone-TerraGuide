import express from 'express';
import {
  getDashboardSummary,
  getChartData,
  getTopProperties,
  getAttentionProperties,
} from '../controllers/AnalyticsController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/dashboard', protect, authorize('admin'), getDashboardSummary);
router.get('/charts', protect, authorize('admin'), getChartData);
router.get('/top-properties', protect, authorize('admin'), getTopProperties);
router.get('/attention-properties', protect, authorize('admin'), getAttentionProperties);

export default router;