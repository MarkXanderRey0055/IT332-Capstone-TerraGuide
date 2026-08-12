import express from 'express';
import {
  getCabinets,
  createCabinet,
  updateCabinet,
  deleteCabinet,
  assignProperties,
  removePropertyFromCabinet,
} from '../controllers/CabinetController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, authorize('admin'), getCabinets);
router.post('/', protect, authorize('admin'), createCabinet);
router.put('/:cabinetId', protect, authorize('admin'), updateCabinet);
router.delete('/:cabinetId', protect, authorize('admin'), deleteCabinet);
router.post('/:cabinetId/properties', protect, authorize('admin'), assignProperties);
router.delete('/properties/:propertyId', protect, authorize('admin'), removePropertyFromCabinet);

export default router;