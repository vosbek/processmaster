import { z } from 'zod';

// Common validation patterns
const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

const uuidSchema = z.string().uuid('Invalid UUID format');
const positiveIntSchema = z.number().int().positive();
const nonEmptyStringSchema = z.string().min(1, 'Field cannot be empty');

// Auth schemas
export const registerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
    email: emailSchema,
    password: passwordSchema,
    jobTitle: z.string().max(100, 'Job title too long').optional(),
    company: z.string().max(100, 'Company name too long').optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(50, 'First name too long').optional(),
    lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long').optional(),
    jobTitle: z.string().max(100, 'Job title too long').optional(),
    company: z.string().max(100, 'Company name too long').optional(),
    bio: z.string().max(500, 'Bio too long').optional(),
    profileImageUrl: z.string().url('Invalid image URL').optional(),
  }),
});

// Guide schemas
export const createGuideSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    category: z.string().min(1, 'Category is required'),
    tags: z.array(z.string()).max(10, 'Too many tags').optional(),
    visibility: z.enum(['public', 'private', 'team'], {
      errorMap: () => ({ message: 'Visibility must be public, private, or team' }),
    }),
    isTemplate: z.boolean().optional(),
  }),
});

export const updateGuideSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    category: z.string().min(1, 'Category is required').optional(),
    tags: z.array(z.string()).max(10, 'Too many tags').optional(),
    visibility: z.enum(['public', 'private', 'team']).optional(),
    isTemplate: z.boolean().optional(),
    steps: z.array(z.object({
      id: z.string().optional(),
      title: z.string().min(1, 'Step title is required'),
      description: z.string().optional(),
      screenshot: z.string().url('Invalid screenshot URL').optional(),
      annotations: z.array(z.object({
        type: z.enum(['arrow', 'highlight', 'text', 'blur']),
        x: z.number(),
        y: z.number(),
        width: z.number().optional(),
        height: z.number().optional(),
        text: z.string().optional(),
      })).optional(),
      order: z.number().int().min(0),
    })).optional(),
  }),
});

export const guideQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Page must be a number').transform(Number).optional(),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional(),
    search: z.string().max(100, 'Search term too long').optional(),
    category: z.string().optional(),
    visibility: z.enum(['public', 'private', 'team', 'all']).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'views']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    tags: z.string().optional(), // Comma-separated tags
  }),
});

// Capture session schemas
export const createCaptureSessionSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
    description: z.string().max(1000, 'Description too long').optional(),
    url: z.string().url('Invalid URL').optional(),
    settings: z.object({
      captureClicks: z.boolean().optional(),
      captureKeystrokes: z.boolean().optional(),
      captureScrolls: z.boolean().optional(),
      captureHovers: z.boolean().optional(),
      quality: z.enum(['low', 'medium', 'high']).optional(),
      fps: z.number().int().min(1).max(60).optional(),
    }).optional(),
  }),
});

export const updateCaptureSessionSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
  body: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
    description: z.string().max(1000, 'Description too long').optional(),
    status: z.enum(['recording', 'processing', 'completed', 'failed']).optional(),
    interactions: z.array(z.object({
      type: z.enum(['click', 'scroll', 'keyboard', 'hover', 'form']),
      timestamp: z.number(),
      x: z.number().optional(),
      y: z.number().optional(),
      element: z.string().optional(),
      value: z.string().optional(),
      screenshot: z.string().url().optional(),
    })).optional(),
  }),
});

// File upload schemas
export const uploadSchema = z.object({
  body: z.object({
    fileName: z.string().min(1, 'File name is required'),
    fileSize: z.number().int().positive('File size must be positive'),
    mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-\+\.]+$/i, 'Invalid MIME type'),
    purpose: z.enum(['profile-image', 'guide-screenshot', 'capture-video', 'document'], {
      errorMap: () => ({ message: 'Invalid upload purpose' }),
    }),
  }),
});

// Team schemas
export const inviteTeamMemberSchema = z.object({
  body: z.object({
    email: emailSchema,
    role: z.enum(['admin', 'member', 'viewer'], {
      errorMap: () => ({ message: 'Role must be admin, member, or viewer' }),
    }),
    message: z.string().max(500, 'Message too long').optional(),
  }),
});

export const updateMemberRoleSchema = z.object({
  params: z.object({
    memberId: uuidSchema,
  }),
  body: z.object({
    role: z.enum(['admin', 'member', 'viewer'], {
      errorMap: () => ({ message: 'Role must be admin, member, or viewer' }),
    }),
  }),
});

// Notification schemas
export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    email: z.object({
      guidePublished: z.boolean().optional(),
      guideComments: z.boolean().optional(),
      captureComplete: z.boolean().optional(),
      teamInvites: z.boolean().optional(),
      systemUpdates: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
    }).optional(),
    push: z.object({
      guidePublished: z.boolean().optional(),
      guideComments: z.boolean().optional(),
      captureComplete: z.boolean().optional(),
      teamInvites: z.boolean().optional(),
    }).optional(),
    frequency: z.enum(['immediate', 'daily', 'weekly', 'never']).optional(),
  }),
});

// User preferences schemas
export const updateUserPreferencesSchema = z.object({
  body: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: z.string().length(2, 'Language code must be 2 characters').optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    defaultGuideVisibility: z.enum(['public', 'private']).optional(),
    autoSaveDrafts: z.boolean().optional(),
    compactView: z.boolean().optional(),
    showTips: z.boolean().optional(),
    analytics: z.boolean().optional(),
  }),
});

// AI processing schemas
export const processWithAISchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required'),
    type: z.enum(['guide-generation', 'step-description', 'title-suggestion', 'summary'], {
      errorMap: () => ({ message: 'Invalid processing type' }),
    }),
    context: z.object({
      url: z.string().url().optional(),
      element: z.string().optional(),
      screenshot: z.string().url().optional(),
    }).optional(),
  }),
});

// Generic ID parameter schema
export const idParamSchema = z.object({
  params: z.object({
    id: uuidSchema,
  }),
});

// Pagination schema
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n <= 100, 'Limit cannot exceed 100').optional(),
  }),
});

// File validation helpers
export const validateFileType = (allowedTypes: string[]) => {
  return z.object({
    file: z.object({
      mimetype: z.string().refine(
        (type) => allowedTypes.includes(type),
        `File type must be one of: ${allowedTypes.join(', ')}`
      ),
    }),
  });
};

export const validateFileSize = (maxSizeBytes: number) => {
  return z.object({
    file: z.object({
      size: z.number().max(maxSizeBytes, `File size cannot exceed ${maxSizeBytes} bytes`),
    }),
  });
};

// Export all schemas for easy access
export const schemas = {
  auth: {
    register: registerSchema,
    login: loginSchema,
    changePassword: changePasswordSchema,
    updateProfile: updateProfileSchema,
  },
  guides: {
    create: createGuideSchema,
    update: updateGuideSchema,
    query: guideQuerySchema,
  },
  capture: {
    create: createCaptureSessionSchema,
    update: updateCaptureSessionSchema,
  },
  upload: uploadSchema,
  team: {
    invite: inviteTeamMemberSchema,
    updateRole: updateMemberRoleSchema,
  },
  notifications: {
    updatePreferences: updateNotificationPreferencesSchema,
  },
  preferences: {
    update: updateUserPreferencesSchema,
  },
  ai: {
    process: processWithAISchema,
  },
  common: {
    idParam: idParamSchema,
    pagination: paginationSchema,
  },
};