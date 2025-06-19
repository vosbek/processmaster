import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadController } from '../controllers/uploadController';

const router = Router();

// All upload routes require authentication
router.use(authMiddleware);

/**
 * @route POST /api/upload/presigned-url
 * @desc Get presigned URL for client-side upload
 * @access Private
 * @body {
 *   filename: string,
 *   contentType: string,
 *   uploadType: 'screenshot' | 'export' | 'profile-image'
 * }
 */
router.post('/presigned-url', uploadController.getPresignedUrl);

/**
 * @route POST /api/upload/screenshot
 * @desc Upload screenshot directly to server
 * @access Private
 * @body multipart/form-data with 'screenshot' file and metadata
 */
router.post('/screenshot', uploadController.uploadScreenshot);

/**
 * @route POST /api/upload/confirm
 * @desc Confirm client-side upload completion
 * @access Private
 * @body {
 *   key: string,
 *   uploadType: string,
 *   metadata?: object
 * }
 */
router.post('/confirm', uploadController.confirmUpload);

/**
 * @route GET /api/upload/download/:key
 * @desc Get presigned download URL for a file
 * @access Private
 * @query expirationTime?: number (seconds)
 */
router.get('/download/:key(*)', uploadController.getDownloadUrl);

/**
 * @route DELETE /api/upload/:key
 * @desc Delete a file
 * @access Private
 */
router.delete('/:key(*)', uploadController.deleteFile);

/**
 * @route GET /api/upload/files
 * @desc List user's uploaded files
 * @access Private
 * @query {
 *   type?: string (content type filter),
 *   limit?: number,
 *   offset?: number
 * }
 */
router.get('/files', uploadController.listUserFiles);

export default router;