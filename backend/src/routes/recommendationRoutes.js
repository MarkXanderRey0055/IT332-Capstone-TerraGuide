import express from 'express';
import { getRecommendations } from '../controllers/recommendationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Private endpoint - Logged-in buyers only
router.get('/', protect, getRecommendations);

export default router;