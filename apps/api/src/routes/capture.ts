import { Router } from 'express';
import { captureController } from '../controllers/captureController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';

const router = Router();

// Apply authentication to all capture routes
router.use(authenticateToken);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
    files: parseInt(process.env.MAX_FILES_PER_UPLOAD || '10'),
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/png,image/jpeg,image/gif,video/mp4,video/webm').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Screen capture session management
router.post('/start', asyncHandler(captureController.startCapture));
router.post('/stop', asyncHandler(captureController.stopCapture));
router.get('/:sessionId/status', asyncHandler(captureController.getCaptureStatus));

// Screenshot upload and processing
router.post('/upload', upload.array('screenshots', 50), asyncHandler(captureController.uploadScreenshots));
router.post('/:sessionId/screenshot', upload.single('screenshot'), asyncHandler(captureController.addScreenshot));

// Interaction data
router.post('/:sessionId/interaction', asyncHandler(captureController.recordInteraction));
router.get('/:sessionId/interactions', asyncHandler(captureController.getInteractions));

// Processing and AI generation
router.post('/:sessionId/process', asyncHandler(captureController.processCapture));
router.get('/:sessionId/result', asyncHandler(captureController.getCaptureResult));

export { router as captureRoutes };