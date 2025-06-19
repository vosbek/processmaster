import { Request, Response } from 'express';
import { db } from '../../../packages/database/src/connection';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const guideController = {
  async getAllGuides(req: AuthenticatedRequest, res: Response) {
    try {
      const { page = 1, limit = 20, status, search, tags } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      let whereClause = 'WHERE (user_id = $1 OR visibility = \'public\')';
      const queryParams = [req.user.userId];
      let paramIndex = 2;

      if (status) {
        whereClause += ` AND status = $${paramIndex}`;
        queryParams.push(status as string);
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (tags) {
        whereClause += ` AND tags && $${paramIndex}`;
        queryParams.push((tags as string).split(','));
        paramIndex++;
      }

      const result = await db.query(
        `SELECT g.*, u.first_name, u.last_name, u.email as author_email,
                COUNT(gs.id) as step_count
         FROM guides g
         JOIN users u ON g.user_id = u.id
         LEFT JOIN guide_steps gs ON g.id = gs.guide_id
         ${whereClause}
         GROUP BY g.id, u.first_name, u.last_name, u.email
         ORDER BY g.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, Number(limit), offset]
      );

      // Get total count
      const countResult = await db.query(
        `SELECT COUNT(DISTINCT g.id) as total
         FROM guides g
         JOIN users u ON g.user_id = u.id
         ${whereClause}`,
        queryParams.slice(0, -2) // Remove limit and offset
      );

      res.json({
        success: true,
        data: {
          guides: result.rows,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: Number(countResult.rows[0].total),
            pages: Math.ceil(Number(countResult.rows[0].total) / Number(limit))
          }
        }
      });
    } catch (error) {
      logger.error('Get all guides error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve guides'
      });
    }
  },

  async createGuide(req: AuthenticatedRequest, res: Response) {
    try {
      const { title, description, content, tags, visibility = 'private', estimatedTime, difficulty } = req.body;

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          error: 'Title and description are required'
        });
      }

      const result = await db.query(
        `INSERT INTO guides (user_id, title, description, content, tags, visibility, estimated_time, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [req.user.userId, title, description, content || {}, tags || [], visibility, estimatedTime, difficulty]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Create guide error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create guide'
      });
    }
  },

  async getGuideById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = (req as AuthenticatedRequest).user;

      const result = await db.query(
        `SELECT g.*, u.first_name, u.last_name, u.email as author_email
         FROM guides g
         JOIN users u ON g.user_id = u.id
         WHERE g.id = $1 AND (g.user_id = $2 OR g.visibility IN ('public', 'organization'))`,
        [id, user?.userId || null]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found or access denied'
        });
      }

      // Get guide steps
      const stepsResult = await db.query(
        `SELECT gs.*, s.file_path as screenshot_url
         FROM guide_steps gs
         LEFT JOIN screenshots s ON gs.screenshot_id = s.id
         WHERE gs.guide_id = $1
         ORDER BY gs.step_number`,
        [id]
      );

      // Increment view count if not the owner
      if (user && user.userId !== result.rows[0].user_id) {
        await db.query(
          'UPDATE guides SET view_count = view_count + 1 WHERE id = $1',
          [id]
        );
      }

      const guide = {
        ...result.rows[0],
        steps: stepsResult.rows
      };

      res.json({
        success: true,
        data: guide
      });
    } catch (error) {
      logger.error('Get guide by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve guide'
      });
    }
  },

  async updateGuide(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { title, description, content, tags, visibility, estimatedTime, difficulty, status } = req.body;

      // Check if user owns the guide or has permission
      const guideResult = await db.query(
        'SELECT user_id FROM guides WHERE id = $1',
        [id]
      );

      if (guideResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found'
        });
      }

      if (guideResult.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      const setClauses = [];
      const values = [];
      let valueIndex = 1;

      if (title) {
        setClauses.push(`title = $${valueIndex++}`);
        values.push(title);
      }

      if (description) {
        setClauses.push(`description = $${valueIndex++}`);
        values.push(description);
      }

      if (content) {
        setClauses.push(`content = $${valueIndex++}`);
        values.push(content);
      }

      if (tags) {
        setClauses.push(`tags = $${valueIndex++}`);
        values.push(tags);
      }

      if (visibility) {
        setClauses.push(`visibility = $${valueIndex++}`);
        values.push(visibility);
      }

      if (estimatedTime) {
        setClauses.push(`estimated_time = $${valueIndex++}`);
        values.push(estimatedTime);
      }

      if (difficulty) {
        setClauses.push(`difficulty = $${valueIndex++}`);
        values.push(difficulty);
      }

      if (status) {
        setClauses.push(`status = $${valueIndex++}`);
        values.push(status);
        
        if (status === 'published') {
          setClauses.push(`published_at = CURRENT_TIMESTAMP`);
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid updates provided'
        });
      }

      setClauses.push(`version = version + 1`);
      values.push(id);

      const result = await db.query(
        `UPDATE guides SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${valueIndex} RETURNING *`,
        values
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update guide error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update guide'
      });
    }
  },

  async deleteGuide(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      // Check if user owns the guide
      const guideResult = await db.query(
        'SELECT user_id FROM guides WHERE id = $1',
        [id]
      );

      if (guideResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found'
        });
      }

      if (guideResult.rows[0].user_id !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      await db.query('DELETE FROM guides WHERE id = $1', [id]);

      res.json({
        success: true,
        message: 'Guide deleted successfully'
      });
    } catch (error) {
      logger.error('Delete guide error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete guide'
      });
    }
  },

  async shareGuide(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { password, expiresAt, maxViews } = req.body;

      // Check if user owns the guide
      const guideResult = await db.query(
        'SELECT user_id, title FROM guides WHERE id = $1',
        [id]
      );

      if (guideResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found'
        });
      }

      if (guideResult.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      // Generate share token
      const token = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);

      let passwordHash = null;
      if (password) {
        const bcrypt = require('bcryptjs');
        passwordHash = await bcrypt.hash(password, 12);
      }

      const result = await db.query(
        `INSERT INTO shared_links (guide_id, created_by, token, password_hash, expires_at, max_views)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, req.user.userId, token, passwordHash, expiresAt, maxViews]
      );

      res.json({
        success: true,
        data: {
          shareUrl: `${process.env.WEB_BASE_URL}/shared/${token}`,
          token: token,
          expiresAt: result.rows[0].expires_at,
          maxViews: result.rows[0].max_views
        }
      });
    } catch (error) {
      logger.error('Share guide error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create share link'
      });
    }
  },

  async getCollaborators(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const result = await db.query(
        `SELECT gc.*, u.first_name, u.last_name, u.email,
                added_by_user.first_name as added_by_first_name,
                added_by_user.last_name as added_by_last_name
         FROM guide_collaborators gc
         JOIN users u ON gc.user_id = u.id
         JOIN users added_by_user ON gc.added_by = added_by_user.id
         WHERE gc.guide_id = $1
         ORDER BY gc.added_at DESC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get collaborators error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve collaborators'
      });
    }
  },

  async addCollaborator(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { email, role = 'editor' } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Check if user owns the guide
      const guideResult = await db.query(
        'SELECT user_id FROM guides WHERE id = $1',
        [id]
      );

      if (guideResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found'
        });
      }

      if (guideResult.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      // Find user by email
      const userResult = await db.query(
        'SELECT id FROM users WHERE email = $1 AND is_active = true',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const collaboratorId = userResult.rows[0].id;

      // Add collaborator
      const result = await db.query(
        `INSERT INTO guide_collaborators (guide_id, user_id, role, added_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guide_id, user_id) DO UPDATE SET role = $3
         RETURNING *`,
        [id, collaboratorId, role, req.user.userId]
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Add collaborator error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add collaborator'
      });
    }
  },

  async removeCollaborator(req: AuthenticatedRequest, res: Response) {
    try {
      const { id, userId } = req.params;

      // Check if user owns the guide
      const guideResult = await db.query(
        'SELECT user_id FROM guides WHERE id = $1',
        [id]
      );

      if (guideResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Guide not found'
        });
      }

      if (guideResult.rows[0].user_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      await db.query(
        'DELETE FROM guide_collaborators WHERE guide_id = $1 AND user_id = $2',
        [id, userId]
      );

      res.json({
        success: true,
        message: 'Collaborator removed successfully'
      });
    } catch (error) {
      logger.error('Remove collaborator error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove collaborator'
      });
    }
  },

  // Export methods (placeholder implementations)
  async exportToPDF(req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: 'PDF export not yet implemented'
    });
  },

  async exportToHTML(req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: 'HTML export not yet implemented'
    });
  },

  async exportToDocx(req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: 'DOCX export not yet implemented'
    });
  },

  async exportToVideo(req: Request, res: Response) {
    res.status(501).json({
      success: false,
      error: 'Video export not yet implemented'
    });
  }
};