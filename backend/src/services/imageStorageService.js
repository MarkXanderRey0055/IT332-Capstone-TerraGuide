import { fileTypeFromBuffer } from 'file-type';
import { getCloudinary } from '../config/cloudinary.js';
import AppError from '../utils/errors.js';

const ALLOWED_FILE_TYPES = new Map([
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
]);

function redactSensitiveText(value) {
  return String(value || 'Unknown Cloudinary upload failure')
    .replace(/(api[_-]?(?:key|secret)|authorization|token|password)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s]+/gi, '[redacted-url]');
}

function getCloudinaryDiagnostics(error) {
  const headers = error?.headers || error?.response?.headers || {};
  return {
    message: redactSensitiveText(error?.message),
    httpStatus: error?.http_code ?? error?.statusCode ?? error?.status ?? error?.response?.status ?? null,
    code: error?.code ?? null,
    requestId: error?.request_id ?? error?.requestId ?? headers['x-request-id'] ?? headers['x-cld-request-id'] ?? null,
  };
}

function logCloudinaryUploadFailure(propertyId, fileCount, error) {
  const diagnostics = getCloudinaryDiagnostics(error);
  console.error('Cloudinary image upload failed', {
    operation: 'uploadPropertyImagesToCloudinary',
    propertyId,
    fileCount,
    ...diagnostics,
    timestamp: new Date().toISOString(),
  });
}

async function validateImageBuffer(file) {
  if (!file?.buffer?.length) {
    throw new AppError('Uploaded image files cannot be empty.', 400);
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !ALLOWED_FILE_TYPES.has(detected.ext)) {
    throw new AppError('The uploaded file is not a valid JPG, JPEG, or PNG image.', 400);
  }

  const expectedMime = ALLOWED_FILE_TYPES.get(detected.ext);
  if (file.mimetype !== expectedMime) {
    throw new AppError('The uploaded file content does not match its declared image type.', 400);
  }

  return detected;
}

function uploadBuffer(cloudinary, buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        type: 'upload',
        overwrite: false,
        invalidate: true,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

export async function uploadPropertyImagesToCloudinary(propertyId, files) {
  const cloudinary = getCloudinary();
  const folder = `terraguide/properties/${propertyId}`;
  const uploaded = [];

  try {
    for (const [index, file] of files.entries()) {
      const detected = await validateImageBuffer(file);
      const result = await uploadBuffer(
        cloudinary,
        file.buffer,
        folder,
        `image-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
      );
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        format: detected.ext,
        bytes: file.size,
      });
    }
    return uploaded;
  } catch (error) {
    if (!(error instanceof AppError)) {
      logCloudinaryUploadFailure(propertyId, files.length, error);
    }
    await cleanupCloudinaryAssets(uploaded, cloudinary);
    if (error instanceof AppError) throw error;
    throw new AppError('Cloudinary could not store the uploaded images.', 502);
  }
}

export async function cleanupCloudinaryAssets(assets, cloudinary = getCloudinary()) {
  await Promise.all(
    assets.map(async (asset) => {
      try {
        await cloudinary.uploader.destroy(asset.publicId, { resource_type: 'image', invalidate: true });
      } catch (cleanupError) {
        console.error('Cloudinary cleanup failed for an uploaded property image', {
          operation: 'cleanupCloudinaryAssets',
          publicId: asset.publicId,
          ...getCloudinaryDiagnostics(cleanupError),
          timestamp: new Date().toISOString(),
        });
      }
    })
  );
}
