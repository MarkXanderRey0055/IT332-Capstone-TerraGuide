import multer from 'multer';
import AppError from '../utils/errors.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      return callback(new AppError('Only JPG, JPEG, and PNG images are supported.', 400));
    }
    callback(null, true);
  },
});

export const uploadPropertyImages = (req, res, next) => {
  upload.array('images', MAX_FILES)(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Each image must be 5 MB or smaller.', 400));
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('You can upload a maximum of 5 images per request.', 400));
      }
    }
    return next(error);
  });
};

export { MAX_FILE_SIZE, MAX_FILES };
