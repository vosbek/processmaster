import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import multer from 'multer';

const router = Router();

// Apply authentication to all AI routes
router.use(authenticateToken);

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for individual images
    files: 20, // Max 20 images per request
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// AI analysis endpoints
router.post('/analyze', upload.array('images', 20), asyncHandler(aiController.analyzeScreenshots));
router.post('/generate', asyncHandler(aiController.generateInstructions));
router.post('/enhance', asyncHandler(aiController.enhanceContent));

// Batch processing
router.post('/batch/analyze', asyncHandler(aiController.batchAnalyze));
router.get('/batch/:jobId/status', asyncHandler(aiController.getBatchStatus));
router.get('/batch/:jobId/result', asyncHandler(aiController.getBatchResult));

// AI model management
router.get('/models', asyncHandler(aiController.getAvailableModels));
router.post('/models/test', asyncHandler(aiController.testModel));

// Content optimization
router.post('/optimize', asyncHandler(aiController.optimizeContent));
router.post('/translate', asyncHandler(aiController.translateContent));

export { router as aiRoutes };