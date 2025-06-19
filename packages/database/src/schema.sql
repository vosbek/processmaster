-- ProcessMaster Pro Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    password_hash VARCHAR(255), -- For local auth (if enabled)
    provider VARCHAR(50) DEFAULT 'local', -- 'local', 'ldap', 'oauth2'
    provider_id VARCHAR(255), -- External provider user ID
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user', 'viewer'
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Organizations table (for enterprise multi-tenancy)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User organization memberships
CREATE TABLE user_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, organization_id)
);

-- Capture sessions table
CREATE TABLE capture_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'stopped', 'processing', 'completed', 'failed'
    browser_info JSONB,
    screen_resolution JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Screenshots table
CREATE TABLE screenshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    s3_key VARCHAR(500),
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    mime_type VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User interactions table
CREATE TABLE user_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_session_id UUID NOT NULL REFERENCES capture_sessions(id) ON DELETE CASCADE,
    screenshot_id UUID REFERENCES screenshots(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    interaction_type VARCHAR(50) NOT NULL, -- 'click', 'type', 'scroll', 'navigate', 'hover'
    element_selector VARCHAR(1000),
    element_text TEXT,
    coordinates JSONB, -- {x: number, y: number}
    input_value TEXT,
    url VARCHAR(1000),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

-- Guides table
CREATE TABLE guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    capture_session_id UUID REFERENCES capture_sessions(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}', -- Rich content structure
    tags TEXT[],
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'published', 'archived'
    visibility VARCHAR(50) DEFAULT 'private', -- 'private', 'organization', 'public'
    estimated_time VARCHAR(50),
    difficulty VARCHAR(50), -- 'beginner', 'intermediate', 'advanced'
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- Guide steps table (denormalized for performance)
CREATE TABLE guide_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT NOT NULL,
    action_type VARCHAR(50), -- 'click', 'type', 'navigate', etc.
    element_description TEXT,
    screenshot_id UUID REFERENCES screenshots(id) ON DELETE SET NULL,
    coordinates JSONB,
    tips TEXT,
    warnings TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Guide collaborators table
CREATE TABLE guide_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guide_id, user_id)
);

-- Guide versions table (for version control)
CREATE TABLE guide_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content JSONB NOT NULL,
    changes_summary TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI processing jobs table
CREATE TABLE ai_processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_session_id UUID REFERENCES capture_sessions(id) ON DELETE CASCADE,
    guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL, -- 'analyze', 'generate', 'enhance', 'translate'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    processing_time INTEGER, -- in milliseconds
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Shared links table
CREATE TABLE shared_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    max_views INTEGER,
    current_views INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usage analytics table
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'share', 'export'
    event_data JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'guide', 'user', 'organization'
    resource_id UUID,
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'share'
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE INDEX idx_capture_sessions_user_id ON capture_sessions(user_id);
CREATE INDEX idx_capture_sessions_organization_id ON capture_sessions(organization_id);
CREATE INDEX idx_capture_sessions_status ON capture_sessions(status);

CREATE INDEX idx_screenshots_capture_session_id ON screenshots(capture_session_id);
CREATE INDEX idx_screenshots_sequence_number ON screenshots(capture_session_id, sequence_number);

CREATE INDEX idx_user_interactions_capture_session_id ON user_interactions(capture_session_id);
CREATE INDEX idx_user_interactions_sequence_number ON user_interactions(capture_session_id, sequence_number);

CREATE INDEX idx_guides_user_id ON guides(user_id);
CREATE INDEX idx_guides_organization_id ON guides(organization_id);
CREATE INDEX idx_guides_status ON guides(status);
CREATE INDEX idx_guides_visibility ON guides(visibility);
CREATE INDEX idx_guides_tags ON guides USING GIN(tags);
CREATE INDEX idx_guides_created_at ON guides(created_at);

CREATE INDEX idx_guide_steps_guide_id ON guide_steps(guide_id);
CREATE INDEX idx_guide_steps_step_number ON guide_steps(guide_id, step_number);

CREATE INDEX idx_guide_collaborators_guide_id ON guide_collaborators(guide_id);
CREATE INDEX idx_guide_collaborators_user_id ON guide_collaborators(user_id);

CREATE INDEX idx_ai_processing_jobs_capture_session_id ON ai_processing_jobs(capture_session_id);
CREATE INDEX idx_ai_processing_jobs_status ON ai_processing_jobs(status);

CREATE INDEX idx_shared_links_guide_id ON shared_links(guide_id);
CREATE INDEX idx_shared_links_token ON shared_links(token);

CREATE INDEX idx_usage_analytics_user_id ON usage_analytics(user_id);
CREATE INDEX idx_usage_analytics_guide_id ON usage_analytics(guide_id);
CREATE INDEX idx_usage_analytics_event_type ON usage_analytics(event_type);
CREATE INDEX idx_usage_analytics_created_at ON usage_analytics(created_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Full-text search indexes
CREATE INDEX idx_guides_title_search ON guides USING GIN(to_tsvector('english', title));
CREATE INDEX idx_guides_description_search ON guides USING GIN(to_tsvector('english', description));
CREATE INDEX idx_guide_steps_description_search ON guide_steps USING GIN(to_tsvector('english', description));

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capture_sessions_updated_at BEFORE UPDATE ON capture_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guides_updated_at BEFORE UPDATE ON guides 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();