import * as propertyService from '../services/propertyService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

//fetch all listed property
export const getProperties = asyncHandler(async (req, res) => {
  const result = await propertyService.getAllProperties(req.query);
  return sendSuccess(res, 200, 'Properties fetched successfully', result);
});

// fetch single property (fetch by id)
export const getPropertyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const property = await propertyService.getPropertyById(id);
  return sendSuccess(res, 200, 'Property details fetched successfully', property);
});

// add property
export const createProperty = asyncHandler(async (req, res) => {
  const property = await propertyService.createProperty(req.body);
  return sendSuccess(res, 201, 'Property listing created successfully', property);
});

//edit
export const updateProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updatedProperty = await propertyService.updateProperty(id, req.body);
  return sendSuccess(res, 200, 'Property listing updated successfully', updatedProperty);
});

//delete a property
export const deleteProperty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await propertyService.deleteProperty(id);
  return sendSuccess(res, 200, 'Property listing deleted successfully', null);
});