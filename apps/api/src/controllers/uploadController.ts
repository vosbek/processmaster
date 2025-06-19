import { Request, Response } from 'express';
import multer from 'multer';
import { s3Service } from '../services/s3Service';
import { DatabaseService } from '../services/databaseService';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/html',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and documents are allowed.'));
    }
  },
});

export class UploadController {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Get presigned URL for client-side upload
   */
  getPresignedUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { filename, contentType, uploadType } = req.body;
      const userId = req.user?.id;

      if (!filename || !contentType || !uploadType) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: filename, contentType, uploadType',
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Validate upload type
      const validUploadTypes = ['screenshot', 'export', 'profile-image'];
      if (!validUploadTypes.includes(uploadType)) {
        res.status(400).json({
          success: false,
          message: 'Invalid upload type',
        });
        return;
      }

      // Generate upload key
      const key = s3Service.generateUploadKey(uploadType, filename, userId);
      
      // Get presigned URL
      const uploadUrl = await s3Service.getUploadUrl(key, contentType, {
        expirationTime: 900, // 15 minutes
        metadata: {
          'user-id': userId,
          'upload-type': uploadType,
          'original-filename': filename,
        },
      });

      res.json({
        success: true,
        data: {
          uploadUrl,
          key,
          bucket: s3Service.getBucketName(),
          expiresIn: 900,
        },
      });
    } catch (error) {
      console.error('Presigned URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate upload URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Upload screenshot directly to server
   */
  uploadScreenshot = [
    upload.single('screenshot'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const file = req.file;
        const { captureSessionId, stepNumber } = req.body;
        const userId = req.user?.id;

        if (!file) {
          res.status(400).json({
            success: false,
            message: 'No file uploaded',
          });
          return;
        }

        if (!userId) {
          res.status(401).json({
            success: false,
            message: 'User not authenticated',
          });
          return;
        }

        if (!captureSessionId) {
          res.status(400).json({
            success: false,
            message: 'Capture session ID is required',
          });
          return;
        }

        // Verify capture session belongs to user
        const captureSession = await this.db.query(
          'SELECT id, user_id FROM capture_sessions WHERE id = $1',
          [captureSessionId]
        );

        if (captureSession.rows.length === 0) {
          res.status(404).json({
            success: false,
            message: 'Capture session not found',
          });
          return;
        }

        if (captureSession.rows[0].user_id !== userId) {
          res.status(403).json({
            success: false,
            message: 'Access denied to capture session',
          });
          return;
        }

        // Upload to S3
        const uploadResult = await s3Service.uploadScreenshot(
          file.buffer,
          userId,
          captureSessionId,
          stepNumber ? parseInt(stepNumber) : undefined
        );

        // Save screenshot record to database
        const screenshotQuery = `
          INSERT INTO screenshots (
            id, capture_session_id, s3_key, s3_url, step_number,
            file_size, content_type, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          ) RETURNING *
        `;

        const screenshotResult = await this.db.query(screenshotQuery, [
          captureSessionId,
          uploadResult.key,
          uploadResult.url,
          stepNumber ? parseInt(stepNumber) : null,
          file.size,
          file.mimetype,
        ]);

        res.status(201).json({
          success: true,
          data: {
            screenshot: screenshotResult.rows[0],
            s3: uploadResult,
          },
        });
      } catch (error) {
        console.error('Screenshot upload error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to upload screenshot',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  ];

  /**
   * Confirm client-side upload completion
   */
  confirmUpload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key, uploadType, metadata } = req.body;
      const userId = req.user?.id;

      if (!key || !uploadType) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: key, uploadType',
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Verify file exists in S3
      const fileExists = await s3Service.fileExists(key);
      if (!fileExists) {
        res.status(404).json({
          success: false,
          message: 'File not found in storage',
        });
        return;
      }

      // Get file metadata
      const fileMetadata = await s3Service.getFileMetadata(key);
      
      // Generate CDN URL
      const cdnUrl = s3Service.getCdnUrl(key);

      // Save upload record based on type
      let result;
      
      if (uploadType === 'screenshot' && metadata?.captureSessionId) {
        const query = `
          INSERT INTO screenshots (
            id, capture_session_id, s3_key, s3_url, step_number,
            file_size, content_type, created_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
          ) RETURNING *
        `;
        
        result = await this.db.query(query, [
          metadata.captureSessionId,
          key,
          cdnUrl,
          metadata.stepNumber || null,
          fileMetadata.contentLength,
          fileMetadata.contentType,
        ]);
      }

      res.json({
        success: true,
        data: {
          key,
          url: cdnUrl,
          metadata: fileMetadata,
          record: result?.rows[0] || null,
        },
      });
    } catch (error) {
      console.error('Upload confirmation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm upload',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Get download URL for a file
   */
  getDownloadUrl = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const { expirationTime } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user has access to this file
      // This would depend on your access control requirements
      // For now, we'll generate the URL if the file exists

      const fileExists = await s3Service.fileExists(key);
      if (!fileExists) {
        res.status(404).json({
          success: false,
          message: 'File not found',
        });
        return;
      }

      const expiration = expirationTime ? parseInt(expirationTime as string) : 3600;
      const downloadUrl = await s3Service.getDownloadUrl(key, {
        expirationTime: expiration,
      });

      res.json({
        success: true,
        data: {
          downloadUrl,
          expiresIn: expiration,
        },
      });
    } catch (error) {
      console.error('Download URL error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate download URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * Delete a file
   */
  deleteFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // Check if user owns this file
      // This would require checking database records
      // For now, we'll allow deletion if file exists

      const fileExists = await s3Service.fileExists(key);
      if (!fileExists) {
        res.status(404).json({
          success: false,
          message: 'File not found',
        });
        return;
      }

      // Delete from S3
      await s3Service.deleteFile(key);

      // Remove database records
      await this.db.query(
        'DELETE FROM screenshots WHERE s3_key = $1',
        [key]
      );

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('File deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete file',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * List user's uploaded files
   */
  listUserFiles = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { type, limit = '20', offset = '0' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      let query = `
        SELECT 
          s.id,
          s.s3_key,
          s.s3_url,
          s.step_number,
          s.file_size,
          s.content_type,
          s.created_at,
          cs.title as capture_session_title
        FROM screenshots s
        LEFT JOIN capture_sessions cs ON s.capture_session_id = cs.id
        WHERE cs.user_id = $1
      `;
      
      const params = [userId];
      
      if (type) {
        query += ` AND s.content_type LIKE $${params.length + 1}`;
        params.push(`${type}%`);
      }
      
      query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit as string, offset as string);

      const result = await this.db.query(query, params);

      res.json({
        success: true,
        data: {
          files: result.rows,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: result.rowCount || 0,
          },
        },
      });
    } catch (error) {
      console.error('List files error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list files',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

export const uploadController = new UploadController();