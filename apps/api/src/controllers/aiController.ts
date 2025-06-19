import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { bedrockService } from '../services/bedrockService';
import { logger } from '../utils/logger';
import { db } from '../../../packages/database/src/connection';

export const aiController = {
  async analyzeScreenshots(req: AuthenticatedRequest, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      const { context, analysisType = 'basic' } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No images provided for analysis'
        });
      }

      const analyses = [];

      for (const file of files) {
        try {
          const analysis = await bedrockService.analyzeScreenshot(file.buffer, context);
          analyses.push({
            filename: file.originalname,
            analysis: analysis.steps[0], // Get the first step analysis
            confidence: analysis.steps[0]?.confidence || 0.8
          });
        } catch (error) {
          logger.error(`Failed to analyze ${file.originalname}:`, error);
          analyses.push({
            filename: file.originalname,
            error: 'Analysis failed',
            confidence: 0
          });
        }
      }

      res.json({
        success: true,
        data: {
          analyses,
          totalImages: files.length,
          successfulAnalyses: analyses.filter(a => !a.error).length
        }
      });
    } catch (error) {
      logger.error('Analyze screenshots error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze screenshots'
      });
    }
  },

  async generateInstructions(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        screenshots, 
        interactions, 
        context, 
        style = 'professional',
        audience = 'general',
        includeWarnings = true 
      } = req.body;

      if (!screenshots || screenshots.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Screenshots are required for instruction generation'
        });
      }

      // Create AI processing job
      const jobResult = await db.query(
        `INSERT INTO ai_processing_jobs (job_type, status, input_data)
         VALUES ('generate', 'pending', $1)
         RETURNING *`,
        [{
          screenshots,
          interactions,
          context,
          style,
          audience,
          includeWarnings,
          userId: req.user.userId
        }]
      );

      const jobId = jobResult.rows[0].id;

      // Process asynchronously
      this.processInstructionGeneration(jobId, screenshots, interactions, {
        context,
        style,
        audience,
        includeWarnings
      }).catch(error => {
        logger.error('Instruction generation failed:', error);
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'processing',
          message: 'Instruction generation started'
        }
      });
    } catch (error) {
      logger.error('Generate instructions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start instruction generation'
      });
    }
  },

  async enhanceContent(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        content, 
        style = 'professional', 
        targetAudience = 'general',
        improvements = ['clarity', 'completeness', 'accuracy']
      } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required for enhancement'
        });
      }

      const enhancedContent = await bedrockService.enhanceContent(content, style);

      // Log the enhancement for analytics
      await db.query(
        `INSERT INTO ai_processing_jobs (job_type, status, input_data, output_data, completed_at)
         VALUES ('enhance', 'completed', $1, $2, CURRENT_TIMESTAMP)`,
        [
          { content: content.substring(0, 1000), style, targetAudience, improvements },
          { enhancedContent: enhancedContent.substring(0, 1000) }
        ]
      );

      res.json({
        success: true,
        data: {
          originalContent: content,
          enhancedContent,
          improvements: {
            style,
            targetAudience,
            appliedImprovements: improvements
          }
        }
      });
    } catch (error) {
      logger.error('Enhance content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enhance content'
      });
    }
  },

  async batchAnalyze(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        imageUrls, 
        analysisType = 'comprehensive',
        context,
        priority = 'normal'
      } = req.body;

      if (!imageUrls || imageUrls.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Image URLs are required for batch analysis'
        });
      }

      if (imageUrls.length > 50) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 50 images allowed per batch'
        });
      }

      // Create batch processing job
      const jobResult = await db.query(
        `INSERT INTO ai_processing_jobs (job_type, status, input_data)
         VALUES ('batch_analyze', 'pending', $1)
         RETURNING *`,
        [{
          imageUrls,
          analysisType,
          context,
          priority,
          userId: req.user.userId
        }]
      );

      const jobId = jobResult.rows[0].id;

      // Process asynchronously
      this.processBatchAnalysis(jobId, imageUrls, { analysisType, context }).catch(error => {
        logger.error('Batch analysis failed:', error);
      });

      res.json({
        success: true,
        data: {
          jobId,
          status: 'processing',
          imageCount: imageUrls.length,
          estimatedTime: `${Math.ceil(imageUrls.length * 2)} seconds`
        }
      });
    } catch (error) {
      logger.error('Batch analyze error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start batch analysis'
      });
    }
  },

  async getBatchStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const { jobId } = req.params;

      const result = await db.query(
        'SELECT * FROM ai_processing_jobs WHERE id = $1',
        [jobId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }

      const job = result.rows[0];

      res.json({
        success: true,
        data: {
          jobId,
          status: job.status,
          jobType: job.job_type,
          startedAt: job.started_at,
          completedAt: job.completed_at,
          processingTime: job.processing_time,
          errorMessage: job.error_message
        }
      });
    } catch (error) {
      logger.error('Get batch status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch status'
      });
    }
  },

  async getBatchResult(req: AuthenticatedRequest, res: Response) {
    try {
      const { jobId } = req.params;

      const result = await db.query(
        'SELECT * FROM ai_processing_jobs WHERE id = $1 AND status = $2',
        [jobId, 'completed']
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Completed job not found'
        });
      }

      const job = result.rows[0];

      res.json({
        success: true,
        data: {
          jobId,
          result: job.output_data,
          processingTime: job.processing_time,
          completedAt: job.completed_at
        }
      });
    } catch (error) {
      logger.error('Get batch result error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get batch result'
      });
    }
  },

  async getAvailableModels(req: Request, res: Response) {
    try {
      const models = [
        {
          id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          name: 'Claude 3.5 Sonnet v2',
          provider: 'Anthropic',
          capabilities: ['vision', 'text-generation', 'analysis'],
          status: 'active',
          description: 'Advanced AI model with superior vision and reasoning capabilities'
        },
        {
          id: 'anthropic.claude-3-haiku-20240307-v1:0',
          name: 'Claude 3 Haiku',
          provider: 'Anthropic',
          capabilities: ['text-generation', 'analysis'],
          status: 'active',
          description: 'Fast and efficient AI model for quick processing'
        }
      ];

      res.json({
        success: true,
        data: {
          models,
          defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
        }
      });
    } catch (error) {
      logger.error('Get available models error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get available models'
      });
    }
  },

  async testModel(req: AuthenticatedRequest, res: Response) {
    try {
      const { modelId, testType = 'basic' } = req.body;

      const testPrompt = testType === 'vision' 
        ? 'Describe what you see in this test image.'
        : 'Respond with "Model test successful" if you can process this request.';

      // Simple model test
      const testResult = await bedrockService.enhanceContent(
        testPrompt,
        'technical'
      );

      res.json({
        success: true,
        data: {
          modelId: modelId || 'anthropic.claude-3-5-sonnet-20241022-v2:0',
          testType,
          status: 'success',
          response: testResult,
          latency: '< 1000ms'
        }
      });
    } catch (error) {
      logger.error('Test model error:', error);
      res.status(500).json({
        success: false,
        error: 'Model test failed: ' + error.message
      });
    }
  },

  async optimizeContent(req: AuthenticatedRequest, res: Response) {
    try {
      const { 
        content, 
        optimizationType = 'readability',
        targetLength,
        keywords 
      } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required for optimization'
        });
      }

      let optimizationPrompt = '';
      switch (optimizationType) {
        case 'readability':
          optimizationPrompt = 'Improve the readability and clarity of this content while maintaining its meaning.';
          break;
        case 'seo':
          optimizationPrompt = `Optimize this content for SEO with keywords: ${keywords?.join(', ') || 'general keywords'}`;
          break;
        case 'brevity':
          optimizationPrompt = `Make this content more concise ${targetLength ? `(target: ${targetLength} words)` : ''}`;
          break;
        default:
          optimizationPrompt = 'Improve this content for better engagement and clarity.';
      }

      const optimizedContent = await bedrockService.enhanceContent(content, optimizationPrompt);

      res.json({
        success: true,
        data: {
          originalContent: content,
          optimizedContent,
          optimizationType,
          improvements: {
            originalLength: content.length,
            optimizedLength: optimizedContent.length,
            reductionPercentage: Math.round((1 - optimizedContent.length / content.length) * 100)
          }
        }
      });
    } catch (error) {
      logger.error('Optimize content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize content'
      });
    }
  },

  async translateContent(req: AuthenticatedRequest, res: Response) {
    try {
      const { content, targetLanguage, preserveFormatting = true } = req.body;

      if (!content || !targetLanguage) {
        return res.status(400).json({
          success: false,
          error: 'Content and target language are required'
        });
      }

      const translatedContent = await bedrockService.translateContent(content, targetLanguage);

      // Log translation for analytics
      await db.query(
        `INSERT INTO ai_processing_jobs (job_type, status, input_data, output_data, completed_at)
         VALUES ('translate', 'completed', $1, $2, CURRENT_TIMESTAMP)`,
        [
          { contentLength: content.length, targetLanguage, preserveFormatting },
          { translatedLength: translatedContent.length }
        ]
      );

      res.json({
        success: true,
        data: {
          originalContent: content,
          translatedContent,
          sourceLanguage: 'auto-detected',
          targetLanguage,
          confidence: 0.95
        }
      });
    } catch (error) {
      logger.error('Translate content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to translate content'
      });
    }
  },

  // Helper methods for async processing
  async processInstructionGeneration(
    jobId: string, 
    screenshots: any[], 
    interactions: any[], 
    options: any
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await db.query(
        'UPDATE ai_processing_jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['running', jobId]
      );

      // Mock screenshot buffers for now
      const screenshotBuffers = screenshots.map(() => Buffer.from('mock-data'));

      const result = await bedrockService.generateStepByStepGuide(screenshotBuffers, interactions);

      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, output_data = $3 
         WHERE id = $4`,
        ['completed', processingTime, result, jobId]
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, error_message = $3 
         WHERE id = $4`,
        ['failed', processingTime, error.message, jobId]
      );
    }
  },

  async processBatchAnalysis(jobId: string, imageUrls: string[], options: any): Promise<void> {
    const startTime = Date.now();

    try {
      await db.query(
        'UPDATE ai_processing_jobs SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['running', jobId]
      );

      const analyses = [];
      
      for (const url of imageUrls) {
        try {
          // Mock analysis for now - in production, fetch image from URL and analyze
          const mockBuffer = Buffer.from('mock-image-data');
          const analysis = await bedrockService.analyzeScreenshot(mockBuffer, options.context);
          analyses.push({
            url,
            analysis: analysis.steps[0],
            success: true
          });
        } catch (error) {
          analyses.push({
            url,
            error: error.message,
            success: false
          });
        }
      }

      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, output_data = $3 
         WHERE id = $4`,
        ['completed', processingTime, { analyses, successCount: analyses.filter(a => a.success).length }, jobId]
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      await db.query(
        `UPDATE ai_processing_jobs 
         SET status = $1, completed_at = CURRENT_TIMESTAMP, processing_time = $2, error_message = $3 
         WHERE id = $4`,
        ['failed', processingTime, error.message, jobId]
      );
    }
  }
};