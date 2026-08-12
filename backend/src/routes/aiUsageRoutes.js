import express from 'express';
import { getUsage } from '../controllers/AIUsageController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Usage numbers are an operational/admin concern only — buyers never see
// the global counter, per the Buyer Portal requirements for this feature.
router.get('/usage', protect, authorize('admin'), getUsage);

export default router;
