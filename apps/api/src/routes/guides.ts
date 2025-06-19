import { Router } from 'express';
import { guideController } from '../controllers/guideController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all guide routes
router.use(authenticateToken);

// Guide CRUD operations
router.get('/', asyncHandler(guideController.getAllGuides));
router.post('/', asyncHandler(guideController.createGuide));
router.get('/:id', asyncHandler(guideController.getGuideById));
router.put('/:id', asyncHandler(guideController.updateGuide));
router.delete('/:id', asyncHandler(guideController.deleteGuide));

// Guide sharing and collaboration
router.post('/:id/share', asyncHandler(guideController.shareGuide));
router.get('/:id/collaborators', asyncHandler(guideController.getCollaborators));
router.post('/:id/collaborators', asyncHandler(guideController.addCollaborator));
router.delete('/:id/collaborators/:userId', asyncHandler(guideController.removeCollaborator));

// Guide export
router.get('/:id/export/pdf', asyncHandler(guideController.exportToPDF));
router.get('/:id/export/html', asyncHandler(guideController.exportToHTML));
router.get('/:id/export/docx', asyncHandler(guideController.exportToDocx));
router.get('/:id/export/video', asyncHandler(guideController.exportToVideo));

export { router as guideRoutes };