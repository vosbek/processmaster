import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface S3UploadOptions {
  bucket?: string;
  key?: string;
  contentType?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  expirationTime?: number; // in seconds
}

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  etag?: string;
  versionId?: string;
}

export interface S3DownloadOptions {
  bucket?: string;
  expirationTime?: number; // in seconds for presigned URLs
}

class S3Service {
  private s3Client: S3Client;
  private defaultBucket: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.defaultBucket = process.env.S3_BUCKET_NAME || 'processmaster-assets';
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  /**
   * Generate a unique key for file storage
   */
  private generateKey(prefix: string, filename?: string, extension?: string): string {
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = uuidv4();
    
    if (filename) {
      const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      return `${prefix}/${timestamp}/${uuid}_${cleanFilename}`;
    }
    
    const ext = extension || 'bin';
    return `${prefix}/${timestamp}/${uuid}.${ext}`;
  }

  /**
   * Generate MD5 hash for file content
   */
  private generateContentHash(content: Buffer): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(
    content: Buffer | Uint8Array | string,
    options: S3UploadOptions = {}
  ): Promise<S3UploadResult> {
    const bucket = options.bucket || this.defaultBucket;
    const key = options.key || this.generateKey('uploads', undefined, 'bin');
    const contentType = options.contentType || 'application/octet-stream';

    // Convert content to Buffer if it's a string
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const contentHash = this.generateContentHash(buffer);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentMD5: Buffer.from(contentHash, 'hex').toString('base64'),
      Metadata: {
        'upload-timestamp': new Date().toISOString(),
        'content-hash': contentHash,
        ...options.metadata,
      },
      Tagging: options.tags ? 
        Object.entries(options.tags).map(([k, v]) => `${k}=${v}`).join('&') : 
        undefined,
    });

    try {
      const response = await this.s3Client.send(command);
      
      return {
        key,
        url: `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`,
        bucket,
        etag: response.ETag,
        versionId: response.VersionId,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a screenshot
   */
  async uploadScreenshot(
    imageBuffer: Buffer,
    userId: string,
    captureSessionId: string,
    stepNumber?: number
  ): Promise<S3UploadResult> {
    const filename = stepNumber ? 
      `step-${stepNumber}-screenshot.png` : 
      `screenshot-${Date.now()}.png`;
    
    const key = this.generateKey('screenshots', filename);
    
    return this.uploadFile(imageBuffer, {
      key,
      contentType: 'image/png',
      metadata: {
        'user-id': userId,
        'capture-session-id': captureSessionId,
        'step-number': stepNumber?.toString() || '',
        'file-type': 'screenshot',
      },
      tags: {
        'Type': 'Screenshot',
        'UserId': userId,
        'CaptureSessionId': captureSessionId,
      },
    });
  }

  /**
   * Upload a guide export (PDF, DOCX, etc.)
   */
  async uploadGuideExport(
    fileBuffer: Buffer,
    guideId: string,
    userId: string,
    format: 'pdf' | 'docx' | 'html',
    filename?: string
  ): Promise<S3UploadResult> {
    const contentTypes = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      html: 'text/html',
    };

    const defaultFilename = filename || `guide-${guideId}-export.${format}`;
    const key = this.generateKey('exports', defaultFilename);
    
    return this.uploadFile(fileBuffer, {
      key,
      contentType: contentTypes[format],
      metadata: {
        'guide-id': guideId,
        'user-id': userId,
        'export-format': format,
        'file-type': 'guide-export',
      },
      tags: {
        'Type': 'GuideExport',
        'GuideId': guideId,
        'UserId': userId,
        'Format': format,
      },
    });
  }

  /**
   * Get a presigned URL for file download
   */
  async getDownloadUrl(
    key: string,
    options: S3DownloadOptions = {}
  ): Promise<string> {
    const bucket = options.bucket || this.defaultBucket;
    const expirationTime = options.expirationTime || 3600; // 1 hour default

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expirationTime,
      });
    } catch (error) {
      console.error('S3 presigned URL error:', error);
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a presigned URL for file upload (client-side uploads)
   */
  async getUploadUrl(
    key: string,
    contentType: string,
    options: S3UploadOptions = {}
  ): Promise<string> {
    const bucket = options.bucket || this.defaultBucket;
    const expirationTime = options.expirationTime || 900; // 15 minutes default

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: options.metadata,
    });

    try {
      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expirationTime,
      });
    } catch (error) {
      console.error('S3 upload URL error:', error);
      throw new Error(`Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;

    const command = new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket || this.defaultBucket;

    const command = new HeadObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    try {
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string, bucket?: string) {
    const targetBucket = bucket || this.defaultBucket;

    const command = new HeadObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    try {
      const response = await this.s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('S3 metadata error:', error);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a key for client-side upload
   */
  generateUploadKey(prefix: string, filename: string, userId: string): string {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return this.generateKey(`${prefix}/${userId}`, cleanFilename);
  }

  /**
   * Clean up old files (utility method)
   */
  async cleanupOldFiles(prefix: string, daysOld: number = 30): Promise<number> {
    // This would require listing objects and deleting old ones
    // Implementation depends on specific cleanup requirements
    // For now, this is a placeholder for future implementation
    console.log(`Cleanup requested for files older than ${daysOld} days with prefix: ${prefix}`);
    return 0;
  }

  /**
   * Get bucket name
   */
  getBucketName(): string {
    return this.defaultBucket;
  }

  /**
   * Get region
   */
  getRegion(): string {
    return this.region;
  }

  /**
   * Generate public URL for a file (if bucket allows public access)
   */
  getPublicUrl(key: string, bucket?: string): string {
    const targetBucket = bucket || this.defaultBucket;
    return `https://${targetBucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate CloudFront URL if CDN is configured
   */
  getCdnUrl(key: string): string {
    const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
    if (cloudfrontDomain) {
      return `https://${cloudfrontDomain}/${key}`;
    }
    return this.getPublicUrl(key);
  }
}

// Export singleton instance
export const s3Service = new S3Service();
export default s3Service;