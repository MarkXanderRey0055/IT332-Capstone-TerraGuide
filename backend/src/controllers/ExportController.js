import * as exportService from '../services/exportService.js';
import AppError from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

/**
 * @desc    Export a single dataset (properties | buyers | transactions) as
 *          CSV or PDF, for admin backup/record-keeping.
 * @route   GET /api/export/:dataset?format=csv|pdf
 * @access  Private (Admin)
 */
export const exportDataset = asyncHandler(async (req, res) => {
  const { dataset } = req.params;
  const format = (req.query.format || 'csv').toLowerCase();

  if (!exportService.EXPORT_DATASET_KEYS.includes(dataset)) {
    throw new AppError(
      `Unknown export dataset "${dataset}". Must be one of: ${exportService.EXPORT_DATASET_KEYS.join(', ')}`,
      400
    );
  }

  if (format === 'csv') {
    return exportService.exportDatasetCSV(dataset, res);
  }

  if (format === 'pdf') {
    return exportService.exportDatasetPDF(dataset, res);
  }

  throw new AppError('Format must be either "csv" or "pdf".', 400);
});

/**
 * @desc    Export all datasets as a ZIP of separate CSV files — the
 *          full-backup option.
 * @route   GET /api/export/all/zip
 * @access  Private (Admin)
 */
export const exportAll = asyncHandler(async (req, res) => {
  return exportService.exportAllDataZip(res);
});
