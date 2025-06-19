import PDFDocument from 'pdfkit';
import { Document, Paragraph, TextRun, ImageRun, AlignmentType, HeadingLevel } from 'docx';
import { s3Service } from './s3Service';
import { DatabaseService } from './databaseService';

export interface GuideExportData {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedTime: string;
  author: {
    firstName: string;
    lastName: string;
  };
  steps: {
    stepNumber: number;
    title: string;
    description: string;
    instruction: string;
    screenshotUrl?: string;
    expectedResult?: string;
    tips?: string[];
    warnings?: string[];
  }[];
  metadata: {
    targetAudience?: string;
    prerequisites?: string[];
    tools?: string[];
    category?: string;
  };
  tags: string[];
  createdAt: string;
}

export class ExportService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Get guide data for export
   */
  private async getGuideData(guideId: string, userId: string): Promise<GuideExportData> {
    const guideQuery = `
      SELECT 
        g.*,
        u.first_name,
        u.last_name,
        COALESCE(
          json_agg(
            json_build_object(
              'stepNumber', gs.step_number,
              'title', gs.title,
              'description', gs.description,
              'instruction', gs.instruction,
              'screenshotUrl', gs.screenshot_url,
              'expectedResult', gs.expected_result,
              'tips', gs.tips,
              'warnings', gs.warnings
            ) ORDER BY gs.step_number
          ) FILTER (WHERE gs.id IS NOT NULL),
          '[]'::json
        ) as steps
      FROM guides g
      LEFT JOIN users u ON g.author_id = u.id
      LEFT JOIN guide_steps gs ON g.id = gs.guide_id
      WHERE g.id = $1 AND (g.author_id = $2 OR g.visibility = 'public')
      GROUP BY g.id, u.first_name, u.last_name
    `;

    const result = await this.db.query(guideQuery, [guideId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Guide not found or access denied');
    }

    const guide = result.rows[0];
    
    return {
      id: guide.id,
      title: guide.title,
      description: guide.description,
      difficulty: guide.difficulty,
      estimatedTime: guide.estimated_time,
      author: {
        firstName: guide.first_name,
        lastName: guide.last_name,
      },
      steps: guide.steps || [],
      metadata: guide.metadata || {},
      tags: guide.tags || [],
      createdAt: guide.created_at,
    };
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Image download error:', error);
      throw new Error('Failed to download image');
    }
  }

  /**
   * Export guide as PDF
   */
  async exportToPDF(guideId: string, userId: string): Promise<Buffer> {
    const guide = await this.getGuideData(guideId, userId);
    
    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Title page
        doc.fontSize(24).text(guide.title, { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(14).text(guide.description, { align: 'center' });
        doc.moveDown();

        // Metadata
        doc.fontSize(12);
        doc.text(`Author: ${guide.author.firstName} ${guide.author.lastName}`);
        doc.text(`Difficulty: ${guide.difficulty}`);
        doc.text(`Estimated Time: ${guide.estimatedTime}`);
        doc.text(`Created: ${new Date(guide.createdAt).toLocaleDateString()}`);
        
        if (guide.tags.length > 0) {
          doc.text(`Tags: ${guide.tags.join(', ')}`);
        }

        doc.moveDown();

        // Prerequisites
        if (guide.metadata.prerequisites && guide.metadata.prerequisites.length > 0) {
          doc.fontSize(14).text('Prerequisites:', { underline: true });
          doc.fontSize(12);
          guide.metadata.prerequisites.forEach(prereq => {
            doc.text(`• ${prereq}`);
          });
          doc.moveDown();
        }

        // Tools required
        if (guide.metadata.tools && guide.metadata.tools.length > 0) {
          doc.fontSize(14).text('Tools Required:', { underline: true });
          doc.fontSize(12);
          guide.metadata.tools.forEach(tool => {
            doc.text(`• ${tool}`);
          });
          doc.moveDown();
        }

        // Steps
        doc.addPage();
        doc.fontSize(18).text('Steps', { underline: true });
        doc.moveDown();

        guide.steps.forEach((step, index) => {
          // Check if we need a new page
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(16).text(`Step ${step.stepNumber}: ${step.title}`, { underline: true });
          doc.moveDown(0.5);

          if (step.description) {
            doc.fontSize(12).text(step.description);
            doc.moveDown(0.5);
          }

          doc.fontSize(12).text('Instructions:', { continued: false });
          doc.fontSize(11).text(step.instruction, { indent: 20 });
          doc.moveDown(0.5);

          if (step.expectedResult) {
            doc.fontSize(12).text('Expected Result:', { continued: false });
            doc.fontSize(11).text(step.expectedResult, { indent: 20 });
            doc.moveDown(0.5);
          }

          if (step.tips && step.tips.length > 0) {
            doc.fontSize(12).text('Tips:', { continued: false });
            step.tips.forEach(tip => {
              doc.fontSize(11).text(`• ${tip}`, { indent: 20 });
            });
            doc.moveDown(0.5);
          }

          if (step.warnings && step.warnings.length > 0) {
            doc.fontSize(12).text('Important:', { continued: false });
            step.warnings.forEach(warning => {
              doc.fontSize(11).text(`⚠ ${warning}`, { indent: 20 });
            });
            doc.moveDown(0.5);
          }

          doc.moveDown();
        });

        // Footer
        doc.fontSize(10).text(
          `Generated by ProcessMaster Pro on ${new Date().toLocaleDateString()}`,
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Export guide as HTML
   */
  async exportToHTML(guideId: string, userId: string): Promise<string> {
    const guide = await this.getGuideData(guideId, userId);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${guide.title}</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            line-height: 1.6; 
        }
        .header { text-align: center; margin-bottom: 2rem; }
        .title { font-size: 2rem; margin-bottom: 0.5rem; }
        .description { font-size: 1.1rem; color: #666; margin-bottom: 1rem; }
        .metadata { background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
        .metadata-item { margin-bottom: 0.5rem; }
        .tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
        .tag { background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.875rem; }
        .prerequisites, .tools { margin-bottom: 2rem; }
        .list-title { font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem; }
        .step { margin-bottom: 2rem; padding: 1rem; border: 1px solid #e0e0e0; border-radius: 8px; }
        .step-header { font-size: 1.3rem; font-weight: bold; margin-bottom: 0.5rem; color: #1976d2; }
        .step-description { color: #666; margin-bottom: 1rem; }
        .instruction { background: #f8f9fa; padding: 1rem; border-left: 4px solid #1976d2; margin-bottom: 1rem; }
        .expected-result { background: #e8f5e8; padding: 1rem; border-left: 4px solid #4caf50; margin-bottom: 1rem; }
        .tips { background: #fff3e0; padding: 1rem; border-left: 4px solid #ff9800; margin-bottom: 1rem; }
        .warnings { background: #ffebee; padding: 1rem; border-left: 4px solid #f44336; margin-bottom: 1rem; }
        .screenshot { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; margin: 1rem 0; }
        .footer { text-align: center; margin-top: 3rem; color: #666; font-size: 0.875rem; }
        ul { padding-left: 1.5rem; }
        li { margin-bottom: 0.25rem; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${guide.title}</h1>
        <p class="description">${guide.description}</p>
        
        <div class="metadata">
            <div class="metadata-item"><strong>Author:</strong> ${guide.author.firstName} ${guide.author.lastName}</div>
            <div class="metadata-item"><strong>Difficulty:</strong> ${guide.difficulty}</div>
            <div class="metadata-item"><strong>Estimated Time:</strong> ${guide.estimatedTime}</div>
            <div class="metadata-item"><strong>Created:</strong> ${new Date(guide.createdAt).toLocaleDateString()}</div>
            ${guide.tags.length > 0 ? `
            <div class="metadata-item">
                <strong>Tags:</strong>
                <div class="tags">
                    ${guide.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    </div>

    ${guide.metadata.prerequisites && guide.metadata.prerequisites.length > 0 ? `
    <div class="prerequisites">
        <div class="list-title">Prerequisites</div>
        <ul>
            ${guide.metadata.prerequisites.map(prereq => `<li>${prereq}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    ${guide.metadata.tools && guide.metadata.tools.length > 0 ? `
    <div class="tools">
        <div class="list-title">Tools Required</div>
        <ul>
            ${guide.metadata.tools.map(tool => `<li>${tool}</li>`).join('')}
        </ul>
    </div>
    ` : ''}

    <div class="steps">
        <h2>Steps</h2>
        ${guide.steps.map(step => `
        <div class="step">
            <div class="step-header">Step ${step.stepNumber}: ${step.title}</div>
            ${step.description ? `<div class="step-description">${step.description}</div>` : ''}
            
            <div class="instruction">
                <strong>Instructions:</strong><br>
                ${step.instruction.replace(/\n/g, '<br>')}
            </div>

            ${step.screenshotUrl ? `<img src="${step.screenshotUrl}" alt="Step ${step.stepNumber} screenshot" class="screenshot">` : ''}

            ${step.expectedResult ? `
            <div class="expected-result">
                <strong>Expected Result:</strong><br>
                ${step.expectedResult.replace(/\n/g, '<br>')}
            </div>
            ` : ''}

            ${step.tips && step.tips.length > 0 ? `
            <div class="tips">
                <strong>Tips:</strong>
                <ul>
                    ${step.tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
            ` : ''}

            ${step.warnings && step.warnings.length > 0 ? `
            <div class="warnings">
                <strong>Important:</strong>
                <ul>
                    ${step.warnings.map(warning => `<li>${warning}</li>`).join('')}
                </ul>
            </div>
            ` : ''}
        </div>
        `).join('')}
    </div>

    <div class="footer">
        Generated by ProcessMaster Pro on ${new Date().toLocaleDateString()}
    </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Export guide and upload to S3
   */
  async exportGuide(
    guideId: string,
    userId: string,
    format: 'pdf' | 'html',
    uploadToS3: boolean = true
  ): Promise<{ buffer: Buffer; url?: string; key?: string }> {
    let buffer: Buffer;
    let contentType: string;
    let filename: string;

    switch (format) {
      case 'pdf':
        buffer = await this.exportToPDF(guideId, userId);
        contentType = 'application/pdf';
        filename = `guide-${guideId}.pdf`;
        break;
      case 'html':
        const htmlContent = await this.exportToHTML(guideId, userId);
        buffer = Buffer.from(htmlContent, 'utf8');
        contentType = 'text/html';
        filename = `guide-${guideId}.html`;
        break;
      default:
        throw new Error('Unsupported export format');
    }

    if (uploadToS3) {
      const uploadResult = await s3Service.uploadGuideExport(
        buffer,
        guideId,
        userId,
        format,
        filename
      );

      return {
        buffer,
        url: uploadResult.url,
        key: uploadResult.key,
      };
    }

    return { buffer };
  }
}

export const exportService = new ExportService();