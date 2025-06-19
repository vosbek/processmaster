import { Request, Response } from 'express';
import { db } from '../../../packages/database/src/connection';
import { AuthenticatedRequest } from '../middleware/auth';
import { bedrockService } from '../services/bedrockService';
import { logger } from '../utils/logger';
import sharp from 'sharp';

export const captureController = {
  async startCapture(req: AuthenticatedRequest, res: Response) {
    try {
      const { title, description, url, browserInfo } = req.body;

      const result = await db.query(
        `INSERT INTO capture_sessions (user_id, title, description, status, browser_info, screen_resolution)
         VALUES ($1, $2, $3, 'active', $4, $5)
         RETURNING *`,
        [
          req.user.userId,
          title || `Capture session ${new Date().toISOString()}`,
          description,
          browserInfo || {},
          browserInfo?.viewport || {}
        ]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Start capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start capture session'
      });
    }
  },

  async stopCapture(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
      }

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT * FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      // Update session status
      const result = await db.query(
        `UPDATE capture_sessions 
         SET status = 'stopped', stopped_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING *`,
        [sessionId]
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Stop capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop capture session'
      });
    }
  },

  async getCaptureStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      const sessionResult = await db.query(
        'SELECT * FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      // Get counts
      const screenshotCount = await db.query(
        'SELECT COUNT(*) as count FROM screenshots WHERE capture_session_id = $1',
        [sessionId]
      );

      const interactionCount = await db.query(
        'SELECT COUNT(*) as count FROM user_interactions WHERE capture_session_id = $1',
        [sessionId]
      );

      res.json({
        success: true,
        data: {
          session: sessionResult.rows[0],
          screenshotCount: Number(screenshotCount.rows[0].count),
          interactionCount: Number(interactionCount.rows[0].count)
        }
      });
    } catch (error) {
      logger.error('Get capture status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get capture status'
      });
    }
  },

  async uploadScreenshots(req: AuthenticatedRequest, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      const { sessionId } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No screenshots provided'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
      }

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT id FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      const uploadedScreenshots = [];

      for (const file of files) {
        try {
          // Process image with Sharp
          const imageBuffer = await sharp(file.buffer)
            .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
            .png({ quality: 90 })
            .toBuffer();

          const metadata = await sharp(imageBuffer).metadata();

          // Save to database (file will be uploaded to S3 later)
          const screenshotResult = await db.query(
            `INSERT INTO screenshots (capture_session_id, sequence_number, file_path, file_size, width, height, mime_type, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
              sessionId,
              uploadedScreenshots.length + 1,
              `screenshots/${sessionId}/${file.filename || Date.now()}.png`,
              imageBuffer.length,
              metadata.width,
              metadata.height,
              'image/png',
              { originalName: file.originalname }
            ]
          );

          uploadedScreenshots.push({
            ...screenshotResult.rows[0],
            buffer: imageBuffer
          });
        } catch (error) {
          logger.error(`Failed to process screenshot ${file.originalname}:`, error);
        }
      }

      res.json({
        success: true,
        data: {
          uploaded: uploadedScreenshots.length,
          screenshots: uploadedScreenshots.map(s => ({
            id: s.id,
            sequenceNumber: s.sequence_number,
            filePath: s.file_path,
            width: s.width,
            height: s.height
          }))
        }
      });
    } catch (error) {
      logger.error('Upload screenshots error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload screenshots'
      });
    }
  },

  async addScreenshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const file = req.file;
      const { sequenceNumber, url, title, timestamp } = req.body;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'Screenshot file is required'
        });
      }

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT id FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      // Process image
      const imageBuffer = await sharp(file.buffer)
        .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();

      const metadata = await sharp(imageBuffer).metadata();

      // Save to database
      const result = await db.query(
        `INSERT INTO screenshots (capture_session_id, sequence_number, file_path, file_size, width, height, mime_type, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          sessionId,
          sequenceNumber || (await this.getNextSequenceNumber(sessionId)),
          `screenshots/${sessionId}/${Date.now()}.png`,
          imageBuffer.length,
          metadata.width,
          metadata.height,
          'image/png',
          { url, title, timestamp, originalName: file.originalname }
        ]
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Add screenshot error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add screenshot'
      });
    }
  },

  async recordInteraction(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;
      const { 
        interactionType, 
        elementSelector, 
        elementText, 
        coordinates, 
        inputValue, 
        url, 
        sequenceNumber,
        metadata 
      } = req.body;

      if (!interactionType) {
        return res.status(400).json({
          success: false,
          error: 'Interaction type is required'
        });
      }

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT id FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      const result = await db.query(
        `INSERT INTO user_interactions (
          capture_session_id, sequence_number, interaction_type, 
          element_selector, element_text, coordinates, input_value, url, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          sessionId,
          sequenceNumber || (await this.getNextInteractionSequence(sessionId)),
          interactionType,
          elementSelector,
          elementText,
          coordinates,
          inputValue,
          url,
          metadata || {}
        ]
      );

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Record interaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record interaction'
      });
    }
  },

  async getInteractions(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT id FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      const result = await db.query(
        `SELECT * FROM user_interactions 
         WHERE capture_session_id = $1 
         ORDER BY sequence_number ASC`,
        [sessionId]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get interactions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get interactions'
      });
    }
  },

  async processCapture(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      // Verify session belongs to user
      const sessionResult = await db.query(
        'SELECT * FROM capture_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.user.userId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Capture session not found'
        });
      }

      const session = sessionResult.rows[0];

      // Update session status to processing
      await db.query(
        'UPDATE capture_sessions SET status = $1 WHERE id = $2',
        ['processing', sessionId]
      );

      // Create AI processing job
      const jobResult = await db.query(
        `INSERT INTO ai_processing_jobs (capture_session_id, job_type, status, input_data)
         VALUES ($1, 'generate', 'pending', $2)
         RETURNING *`,
        [sessionId, { sessionId, userId: req.user.userId }]
      );

      const jobId = jobResult.rows[0].id;

      // Process asynchronously
      this.processWithAI(sessionId, jobId, req.user.userId).catch(error => {
        logger.error('AI processing failed:', error);
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'processing',
          message: 'AI processing started'
        }
      });
    } catch (error) {
      logger.error('Process capture error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start processing'
      });
    }
  },

  async getCaptureResult(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId } = req.params;

      // Get the latest processing job for this session
      const jobResult = await db.query(
        `SELECT * FROM ai_processing_jobs 
         WHERE capture_session_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [sessionId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No processing job found'
        });
      }

      const job = jobResult.rows[0];

      if (job.status === 'completed' && job.output_data?.guideId) {
        // Get the generated guide
        const guideResult = await db.query(
          'SELECT * FROM guides WHERE id = $1',
          [job.output_data.guideId]
        );

        res.json({
          success: true,
          data: {
            status: 'completed',
            guideId: job.output_data.guideId,
            guide: guideResult.rows[0],
            processingTime: job.processing_time
          }
        });
      } else if (job.status === 'failed') {
        res.json({
          success: false,
          error: job.error_message || 'Processing failed'
        });
      } else {
        res.json({
          success: true,
          data: {
            status: job.status,
            message: 'Processing in progress...'
          }
        });
      }
    } catch (error) {
      logger.error('Get capture result error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get capture result'
      });
    }
  },

  // Helper methods
  async getNextSequenceNumber(sessionId: string): Promise<number> {
    const result = await db.query(
      'SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq FROM screenshots WHERE capture_session_id = $1',
      [sessionId]
    );
    return result.rows[0].next_seq;
  },

  async getNextInteractionSequence(sessionId: string): Promise<number> {
    const result = await db.query(
      'SELECT COALESCE(MAX(sequence_number), 0) + 1 as next_seq FROM user_interactions WHERE capture_session_id = $1',
      [sessionId]
    );
    return result.rows[0].next_seq;
  },

  async processWithAI(sessionId: string, jobId: string, userId: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update job status
      await db.query(
        'UPDATE ai_processing_jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['running', jobId]
      );

      // Get screenshots and interactions
      const screenshotsResult = await db.query(
        'SELECT * FROM screenshots WHERE capture_session_id = $1 ORDER BY sequence_number',
        [sessionId]
      );

      const interactionsResult = await db.query(
        'SELECT * FROM user_interactions WHERE capture_session_id = $1 ORDER BY sequence_number',
        [sessionId]
      );

      const screenshots = screenshotsResult.rows;
      const interactions = interactionsResult.rows;

      if (screenshots.length === 0) {
        throw new Error('No screenshots found for processing');
      }

      // TODO: Load actual screenshot buffers from S3/file system
      // For now, create mock buffers
      const screenshotBuffers = screenshots.map(() => Buffer.from('mock-screenshot-data'));

      // Process with AI
      const aiResult = await bedrockService.generateStepByStepGuide(screenshotBuffers, interactions);

      // Create guide
      const guideResult = await db.query(
        `INSERT INTO guides (user_id, capture_session_id, title, description, content, difficulty, estimated_time, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING *`,
        [
          userId,
          sessionId,
          `Process Guide - ${new Date().toLocaleDateString()}`,
          aiResult.summary,
          { steps: aiResult.steps, metadata: { aiGenerated: true } },
          aiResult.difficulty,
          aiResult.estimatedTime
        ]
      );

      const guide = guideResult.rows[0];

      // Create guide steps
      for (const step of aiResult.steps) {
        await db.query(
          `INSERT INTO guide_steps (guide_id, step_number, title, description, action_type, element_description, coordinates)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            guide.id,
            step.order,
            `Step ${step.order}`,
            step.description,
            step.action,
            step.element,
            step.coordinates
          ]
        );
      }

      // Update session status
      await db.query(
        'UPDATE capture_sessions SET status = $1, processed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', sessionId]
      );

      // Update job status
      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, output_data = $3 
         WHERE id = $4`,
        ['completed', processingTime, { guideId: guide.id }, jobId]
      );

    } catch (error) {
      logger.error('AI processing error:', error);

      // Update job with error
      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, error_message = $3 
         WHERE id = $4`,
        ['failed', processingTime, error.message, jobId]
      );

      // Update session status
      await db.query(
        'UPDATE capture_sessions SET status = $1 WHERE id = $2',
        ['failed', sessionId]
      );
    }
  }
};