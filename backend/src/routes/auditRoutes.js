import express from 'express';
import { generateAudit, getAuditHistory } from '../controllers/AuditController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin-only, same as property create/update/delete — this is an internal
// admin tool, buyers never see or trigger it.
router.post('/generate', protect, authorize('admin'), generateAudit);
router.get('/:propertyId', protect, authorize('admin'), getAuditHistory);

export default router;