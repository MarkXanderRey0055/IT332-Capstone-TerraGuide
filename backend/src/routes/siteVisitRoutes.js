import express from 'express';
import {
  createSiteVisit,
  getMySiteVisits,
  getAllSiteVisits,
  updateSiteVisitStatus,
} from '../controllers/SiteVisitController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Buyer routes
router.post('/', protect, authorize('buyer'), createSiteVisit);
router.get('/', protect, authorize('buyer'), getMySiteVisits);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllSiteVisits);
router.put('/admin/:id', protect, authorize('admin'), updateSiteVisitStatus);

export default router;
