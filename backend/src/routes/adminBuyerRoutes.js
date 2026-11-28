import express from 'express';
import {
  getBuyers,
  getBuyerDetails,
  createBuyer,
  updateBuyer,
  deleteBuyer,
} from '../controllers/AdminBuyerController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), getBuyers);
router.get('/:userId/details', protect, authorize('admin'), getBuyerDetails);
router.post('/', protect, authorize('admin'), createBuyer);
router.put('/:userId', protect, authorize('admin'), updateBuyer);
router.delete('/:userId', protect, authorize('admin'), deleteBuyer);

export default router;