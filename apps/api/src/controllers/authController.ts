import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';
import { ldapService } from '../services/ldapService';
import { oauth2Service } from '../services/oauth2Service';
import { userService } from '../services/userService';

export const authController = {
  async login(req: Request, res: Response) {
    const { email, password, provider } = req.body;

    try {
      let user;
      
      if (provider === 'ldap') {
        user = await ldapService.authenticate(email, password);
      } else if (provider === 'oauth2') {
        return res.status(400).json({
          success: false,
          error: 'OAuth2 login should use the authorize endpoint',
        });
      } else {
        // Local authentication (if enabled)
        user = await userService.authenticateLocal(email, password);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
      );

      // Save refresh token to database
      await userService.saveRefreshToken(user.id, refreshToken);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          token,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
      });
    }
  },

  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await userService.revokeRefreshToken(refreshToken);
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
      });
    }
  },

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required',
        });
      }

      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
      const user = await userService.getUserById(decoded.userId);

      if (!user || !await userService.validateRefreshToken(user.id, refreshToken)) {
        return res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
        });
      }

      const newToken = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      res.json({
        success: true,
        data: {
          token: newToken,
        },
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
      });
    }
  },

  async getProfile(req: Request, res: Response) {
    try {
      const user = await userService.getUserById((req as any).user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile',
      });
    }
  },

  async oauth2Authorize(req: Request, res: Response) {
    try {
      const authUrl = oauth2Service.getAuthorizationUrl();
      res.redirect(authUrl);
    } catch (error) {
      logger.error('OAuth2 authorize error:', error);
      res.status(500).json({
        success: false,
        error: 'OAuth2 authorization failed',
      });
    }
  },

  async oauth2Callback(req: Request, res: Response) {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({
          success: false,
          error: 'Authorization code required',
        });
      }

      const tokenData = await oauth2Service.exchangeCodeForToken(code as string);
      const userInfo = await oauth2Service.getUserInfo(tokenData.access_token);

      let user = await userService.getUserByEmail(userInfo.email);
      if (!user) {
        user = await userService.createUser({
          email: userInfo.email,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          provider: 'oauth2',
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
      );

      await userService.saveRefreshToken(user.id, refreshToken);

      // Redirect to frontend with token
      const frontendUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&refreshToken=${refreshToken}`);
    } catch (error) {
      logger.error('OAuth2 callback error:', error);
      res.status(500).json({
        success: false,
        error: 'OAuth2 callback failed',
      });
    }
  },

  async ldapLogin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;

      const user = await ldapService.authenticate(username, password);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid LDAP credentials',
        });
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET!,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
      );

      await userService.saveRefreshToken(user.id, refreshToken);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          token,
          refreshToken,
        },
      });
    } catch (error) {
      logger.error('LDAP login error:', error);
      res.status(500).json({
        success: false,
        error: 'LDAP authentication failed',
      });
    }
  },
};