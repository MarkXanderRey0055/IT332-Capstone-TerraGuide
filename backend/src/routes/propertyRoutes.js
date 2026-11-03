import express from 'express';
import {
  getProperties,
  getPropertyById, 
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyImages,
} from '../controllers/propertyController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validatePropertyInput } from '../middleware/propertyValidation.js';
import { uploadPropertyImages as parsePropertyImages } from '../middleware/propertyImageUpload.js';

const router = express.Router();

// buyer routes
router.get('/', getProperties);
router.get('/:id', getPropertyById); //search

// admin routes
router.post('/', protect, authorize('admin'), validatePropertyInput, createProperty);
router.post('/:id/images', protect, authorize('admin'), parsePropertyImages, uploadPropertyImages);
router.put('/:id', protect, authorize('admin'), validatePropertyInput, updateProperty);
router.delete('/:id', protect, authorize('admin'), deleteProperty);

export default router;
