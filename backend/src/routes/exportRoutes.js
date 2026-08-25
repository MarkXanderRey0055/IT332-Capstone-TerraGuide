import express from 'express';
import { exportDataset, exportAll } from '../controllers/ExportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Order matters: '/all/zip' must be registered before the generic
// '/:dataset' route so it isn't swallowed by the param route.
router.get('/all/zip', protect, authorize('admin'), exportAll);
router.get('/:dataset', protect, authorize('admin'), exportDataset);

export default router;
