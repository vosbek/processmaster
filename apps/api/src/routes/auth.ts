import { Router } from 'express';
import { authController } from '../controllers/authController';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// LDAP/OAuth2 authentication routes
router.post('/login', asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/refresh', asyncHandler(authController.refreshToken));
router.get('/me', asyncHandler(authController.getProfile));

// OAuth2 routes
router.get('/oauth2/authorize', asyncHandler(authController.oauth2Authorize));
router.get('/oauth2/callback', asyncHandler(authController.oauth2Callback));

// LDAP routes
router.post('/ldap/login', asyncHandler(authController.ldapLogin));

export { router as authRoutes };