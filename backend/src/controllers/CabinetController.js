import * as cabinetService from '../services/cabinetService.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    List all cabinets with filed/remaining counts, plus the
 *          unassigned property count
 * @route   GET /api/cabinets
 * @access  Private (Admin)
 */
export const getCabinets = asyncHandler(async (req, res) => {
  const result = await cabinetService.listCabinets();
  return sendSuccess(res, 200, 'Cabinets fetched successfully', result);
});

/**
 * @desc    Create a new filing cabinet
 * @route   POST /api/cabinets
 * @access  Private (Admin)
 */
export const createCabinet = asyncHandler(async (req, res) => {
  const cabinet = await cabinetService.createCabinet(req.body);
  return sendSuccess(res, 201, 'Filing cabinet created successfully', cabinet);
});

/**
 * @desc    Update a cabinet's name, description, capacity, and/or color
 * @route   PUT /api/cabinets/:cabinetId
 * @access  Private (Admin)
 */
export const updateCabinet = asyncHandler(async (req, res) => {
  const { cabinetId } = req.params;
  const cabinet = await cabinetService.updateCabinet(cabinetId, req.body);
  return sendSuccess(res, 200, 'Filing cabinet updated successfully', cabinet);
});

/**
 * @desc    Delete a cabinet — properties filed in it become Unassigned,
 *          never deleted
 * @route   DELETE /api/cabinets/:cabinetId
 * @access  Private (Admin)
 */
export const deleteCabinet = asyncHandler(async (req, res) => {
  const { cabinetId } = req.params;
  await cabinetService.deleteCabinet(cabinetId);
  return sendSuccess(res, 200, 'Filing cabinet deleted successfully', null);
});

/**
 * @desc    File one or more existing properties into a cabinet. Also how
 *          moving a property between cabinets works — call this with the
 *          destination cabinet id.
 * @route   POST /api/cabinets/:cabinetId/properties
 * @access  Private (Admin)
 */
export const assignProperties = asyncHandler(async (req, res) => {
  const { cabinetId } = req.params;
  const { propertyIds } = req.body;
  const result = await cabinetService.assignPropertiesToCabinet(cabinetId, propertyIds);
  return sendSuccess(res, 200, 'Properties filed successfully', result);
});

/**
 * @desc    Remove a single property from its current cabinet — the
 *          property becomes Unassigned, it is never deleted
 * @route   DELETE /api/cabinets/properties/:propertyId
 * @access  Private (Admin)
 */
export const removePropertyFromCabinet = asyncHandler(async (req, res) => {
  const { propertyId } = req.params;
  const property = await cabinetService.removePropertyFromCabinet(propertyId);
  return sendSuccess(res, 200, 'Property removed from cabinet successfully', property);
});