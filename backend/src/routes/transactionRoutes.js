import express from 'express';
import {
  getTransactions,
  getPendingCount,
  getTransaction,
  createTransaction,
  updateTransaction,
  correctTransaction,
} from '../controllers/TransactionController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();


router.get('/', protect, authorize('admin'), getTransactions);
router.get('/stats/pending', protect, authorize('admin'), getPendingCount);
router.get('/:id', protect, authorize('admin'), getTransaction);
router.post('/', protect, authorize('admin'), createTransaction);
router.put('/:id', protect, authorize('admin'), updateTransaction);
router.post('/:id/correct', protect, authorize('admin'), correctTransaction);

export default router;
