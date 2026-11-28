import multer from 'multer';
import AppError from '../utils/errors.js';

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROFILE_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      return callback(new AppError('Only JPG, JPEG, and PNG images are supported.', 400));
    }
    callback(null, true);
  },
});

export const uploadProfilePicture = (req, res, next) => {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Profile picture must be 5 MB or smaller.', 400));
      }
      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('Please upload a single image file.', 400));
      }
    }
    return next(error);
  });
};

export { MAX_PROFILE_IMAGE_SIZE };
