import { PoolClient } from 'pg';

export const up = async (client: PoolClient): Promise<void> => {
  await client.query(`
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";

    -- Migration tracking table
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Users table
    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        password_hash VARCHAR(255),
        provider VARCHAR(50) DEFAULT 'local',
        provider_id VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
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

    -- Organizations table
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
        role VARCHAR(50) DEFAULT 'member',
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
        status VARCHAR(50) DEFAULT 'active',
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
        interaction_type VARCHAR(50) NOT NULL,
        element_selector VARCHAR(1000),
        element_text TEXT,
        coordinates JSONB,
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
        content JSONB NOT NULL DEFAULT '{}',
        tags TEXT[],
        status VARCHAR(50) DEFAULT 'draft',
        visibility VARCHAR(50) DEFAULT 'private',
        estimated_time VARCHAR(50),
        difficulty VARCHAR(50),
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP WITH TIME ZONE
    );

    -- Guide steps table
    CREATE TABLE guide_steps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        guide_id UUID NOT NULL REFERENCES guides(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        title VARCHAR(255),
        description TEXT NOT NULL,
        action_type VARCHAR(50),
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
        role VARCHAR(50) DEFAULT 'editor',
        added_by UUID NOT NULL REFERENCES users(id),
        added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(guide_id, user_id)
    );

    -- AI processing jobs table
    CREATE TABLE ai_processing_jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        capture_session_id UUID REFERENCES capture_sessions(id) ON DELETE CASCADE,
        guide_id UUID REFERENCES guides(id) ON DELETE CASCADE,
        job_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        input_data JSONB,
        output_data JSONB,
        error_message TEXT,
        processing_time INTEGER,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX idx_users_email ON users(email);
    CREATE INDEX idx_users_provider ON users(provider);
    CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX idx_capture_sessions_user_id ON capture_sessions(user_id);
    CREATE INDEX idx_screenshots_capture_session_id ON screenshots(capture_session_id);
    CREATE INDEX idx_user_interactions_capture_session_id ON user_interactions(capture_session_id);
    CREATE INDEX idx_guides_user_id ON guides(user_id);
    CREATE INDEX idx_guides_status ON guides(status);
    CREATE INDEX idx_guide_steps_guide_id ON guide_steps(guide_id);

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
  `);
};

export const down = async (client: PoolClient): Promise<void> => {
  await client.query(`
    DROP TABLE IF EXISTS guide_collaborators CASCADE;
    DROP TABLE IF EXISTS guide_steps CASCADE;
    DROP TABLE IF EXISTS guides CASCADE;
    DROP TABLE IF EXISTS ai_processing_jobs CASCADE;
    DROP TABLE IF EXISTS user_interactions CASCADE;
    DROP TABLE IF EXISTS screenshots CASCADE;
    DROP TABLE IF EXISTS capture_sessions CASCADE;
    DROP TABLE IF EXISTS user_organizations CASCADE;
    DROP TABLE IF EXISTS organizations CASCADE;
    DROP TABLE IF EXISTS refresh_tokens CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
    DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
    DROP EXTENSION IF EXISTS "pg_trgm";
    DROP EXTENSION IF EXISTS "uuid-ossp";
  `);
};