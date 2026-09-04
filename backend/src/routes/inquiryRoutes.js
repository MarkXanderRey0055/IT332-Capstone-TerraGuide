import express from 'express';
import {
  createInquiry,
  getMyInquiries,
  getAllInquiries,
  updateInquiryStatus,
} from '../controllers/InquiryController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Buyer routes
router.post('/', protect, authorize('buyer'), createInquiry);
router.get('/', protect, authorize('buyer'), getMyInquiries);

// Admin routes
router.get('/admin/all', protect, authorize('admin'), getAllInquiries);
router.put('/admin/:id', protect, authorize('admin'), updateInquiryStatus);

export default router;
