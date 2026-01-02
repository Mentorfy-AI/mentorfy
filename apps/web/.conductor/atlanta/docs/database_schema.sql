-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types/enums
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE job_type AS ENUM ('document_process', 'document_sync', 'embedding_generation');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE response_length AS ENUM ('brief', 'moderate', 'detailed');
CREATE TYPE creativity_level AS ENUM ('conservative', 'balanced', 'creative');
CREATE TYPE sync_status AS ENUM ('never_synced', 'synced', 'sync_failed', 'sync_pending');

-- Organization table
CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User organization memberships (many-to-many for future flexibility)
CREATE TABLE user_organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Document table
CREATE TABLE document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual_upload',
    external_id TEXT,
    source_metadata JSONB DEFAULT '{}',
    file_type TEXT,
    file_size BIGINT,
    storage_path TEXT,
    content_hash TEXT,
    processing_status processing_status DEFAULT 'pending',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_status sync_status DEFAULT 'never_synced',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Document chunk table (where vector embeddings are stored)
CREATE TABLE document_chunk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536), -- Adjust dimension based on your embedding model
    chunk_index INTEGER NOT NULL,
    token_count INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mentor bot table
CREATE TABLE mentor_bot (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL DEFAULT 'You are a helpful AI assistant.',
    response_length response_length DEFAULT 'moderate',
    creativity creativity_level DEFAULT 'balanced',
    custom_instructions TEXT[] DEFAULT ARRAY[]::TEXT[],
    speaking_style TEXT,
    model_version TEXT DEFAULT 'gpt-3.5-turbo',
    temperature DECIMAL(3,2) DEFAULT 0.7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for bot-document relationships
CREATE TABLE bot_document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_bot_id UUID NOT NULL REFERENCES mentor_bot(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    UNIQUE(mentor_bot_id, document_id)
);

-- Processing job table for async operations
CREATE TABLE processing_job (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type job_type NOT NULL,
    status job_status DEFAULT 'pending',
    document_id UUID REFERENCES document(id) ON DELETE CASCADE,
    mentor_bot_id UUID REFERENCES mentor_bot(id) ON DELETE CASCADE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation table
CREATE TABLE conversation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mentor_bot_id UUID NOT NULL REFERENCES mentor_bot(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Message table
CREATE TABLE message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_document_organization_id ON document(organization_id);
CREATE INDEX idx_document_source_type ON document(source_type);
CREATE INDEX idx_document_processing_status ON document(processing_status);
CREATE INDEX idx_document_chunk_document_id ON document_chunk(document_id);
CREATE INDEX idx_document_chunk_embedding ON document_chunk USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_mentor_bot_organization_id ON mentor_bot(organization_id);
CREATE INDEX idx_bot_document_mentor_bot_id ON bot_document(mentor_bot_id);
CREATE INDEX idx_bot_document_document_id ON bot_document(document_id);
CREATE INDEX idx_processing_job_status ON processing_job(status);
CREATE INDEX idx_processing_job_document_id ON processing_job(document_id);
CREATE INDEX idx_conversation_user_id ON conversation(user_id);
CREATE INDEX idx_conversation_mentor_bot_id ON conversation(mentor_bot_id);
CREATE INDEX idx_message_conversation_id ON message(conversation_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_organization_updated_at BEFORE UPDATE ON organization FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_document_updated_at BEFORE UPDATE ON document FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentor_bot_updated_at BEFORE UPDATE ON mentor_bot FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_job_updated_at BEFORE UPDATE ON processing_job FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversation_updated_at BEFORE UPDATE ON conversation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for multi-tenancy
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE document ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_bot ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE message ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Helper function to check if user belongs to organization
CREATE OR REPLACE FUNCTION user_has_org_access(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_organization 
        WHERE user_id = auth.uid() AND organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-add creator to organization on creation
CREATE OR REPLACE FUNCTION add_creator_to_org()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_organization (user_id, organization_id, role)
    VALUES (auth.uid(), NEW.id, 'owner')
    ON CONFLICT (user_id, organization_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER auto_add_org_creator
AFTER INSERT ON organization
FOR EACH ROW
EXECUTE FUNCTION add_creator_to_org();

-- ============================================
-- SERVICE FUNCTIONS FOR BACKGROUND JOBS
-- ============================================

-- Function for background services to update document processing status
CREATE OR REPLACE FUNCTION service_update_document_status(
    doc_id UUID,
    new_status processing_status,
    error_msg TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE document 
    SET 
        processing_status = new_status,
        updated_at = NOW()
    WHERE id = doc_id;
    
    -- Update related job if exists
    UPDATE processing_job
    SET 
        status = CASE 
            WHEN new_status = 'completed' THEN 'completed'::job_status
            WHEN new_status = 'failed' THEN 'failed'::job_status
            WHEN new_status = 'processing' THEN 'running'::job_status
            ELSE 'pending'::job_status
        END,
        error_message = error_msg,
        updated_at = NOW()
    WHERE document_id = doc_id AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for background services to create document chunks
CREATE OR REPLACE FUNCTION service_create_document_chunk(
    doc_id UUID,
    chunk_content TEXT,
    chunk_embedding vector(1536),
    chunk_idx INTEGER,
    tokens INTEGER DEFAULT NULL,
    chunk_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    chunk_id UUID;
BEGIN
    INSERT INTO document_chunk (
        document_id, 
        content, 
        embedding, 
        chunk_index, 
        token_count, 
        metadata
    )
    VALUES (
        doc_id, 
        chunk_content, 
        chunk_embedding, 
        chunk_idx, 
        tokens, 
        chunk_metadata
    )
    RETURNING id INTO chunk_id;
    
    RETURN chunk_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Organization policies
CREATE POLICY "Users can view their organizations" 
    ON organization FOR SELECT 
    USING (user_has_org_access(id));

CREATE POLICY "Authenticated users can create organizations" 
    ON organization FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their organizations" 
    ON organization FOR UPDATE 
    USING (user_has_org_access(id));

CREATE POLICY "Users can delete their organizations" 
    ON organization FOR DELETE 
    USING (user_has_org_access(id));

-- User organization policies
CREATE POLICY "Users can view memberships" 
    ON user_organization FOR SELECT 
    USING (user_id = auth.uid() OR user_has_org_access(organization_id));

CREATE POLICY "Users can add members to their orgs" 
    ON user_organization FOR INSERT 
    WITH CHECK (
        -- Allow trigger to add creator
        auth.uid() IS NOT NULL AND (
            -- User being added by trigger
            user_id = auth.uid() OR
            -- Existing member adding someone else
            user_has_org_access(organization_id)
        )
    );

CREATE POLICY "Users can update memberships in their orgs" 
    ON user_organization FOR UPDATE 
    USING (user_has_org_access(organization_id));

CREATE POLICY "Users can remove members from their orgs" 
    ON user_organization FOR DELETE 
    USING (
        -- Users can remove themselves OR remove others if they're in the org
        user_id = auth.uid() OR user_has_org_access(organization_id)
    );

-- Document policies
CREATE POLICY "Users can view org documents" 
    ON document FOR SELECT 
    USING (user_has_org_access(organization_id));

CREATE POLICY "Users can create org documents" 
    ON document FOR INSERT 
    WITH CHECK (user_has_org_access(organization_id));

CREATE POLICY "Users can update org documents" 
    ON document FOR UPDATE 
    USING (user_has_org_access(organization_id));

CREATE POLICY "Users can delete org documents" 
    ON document FOR DELETE 
    USING (user_has_org_access(organization_id));

-- Document chunk policies
CREATE POLICY "Users can view org document chunks" 
    ON document_chunk FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = document_chunk.document_id 
            AND user_has_org_access(document.organization_id)
        )
    );

CREATE POLICY "Users can create org document chunks" 
    ON document_chunk FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = document_chunk.document_id 
            AND user_has_org_access(document.organization_id)
        )
    );

CREATE POLICY "Users can update org document chunks" 
    ON document_chunk FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = document_chunk.document_id 
            AND user_has_org_access(document.organization_id)
        )
    );

CREATE POLICY "Users can delete org document chunks" 
    ON document_chunk FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = document_chunk.document_id 
            AND user_has_org_access(document.organization_id)
        )
    );

-- Mentor bot policies
CREATE POLICY "Users can view org mentor bots" 
    ON mentor_bot FOR SELECT 
    USING (user_has_org_access(organization_id));

CREATE POLICY "Users can create org mentor bots" 
    ON mentor_bot FOR INSERT 
    WITH CHECK (user_has_org_access(organization_id));

CREATE POLICY "Users can update org mentor bots" 
    ON mentor_bot FOR UPDATE 
    USING (user_has_org_access(organization_id));

CREATE POLICY "Users can delete org mentor bots" 
    ON mentor_bot FOR DELETE 
    USING (user_has_org_access(organization_id));

-- Bot document policies
CREATE POLICY "Users can view org bot documents" 
    ON bot_document FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = bot_document.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        )
    );

CREATE POLICY "Users can create org bot documents" 
    ON bot_document FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = bot_document.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        )
    );

CREATE POLICY "Users can update org bot documents" 
    ON bot_document FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = bot_document.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        )
    );

CREATE POLICY "Users can delete org bot documents" 
    ON bot_document FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = bot_document.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        )
    );

-- Processing job policies
CREATE POLICY "Users can view org processing jobs" 
    ON processing_job FOR SELECT 
    USING (
        (document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = processing_job.document_id 
            AND user_has_org_access(document.organization_id)
        )) OR
        (mentor_bot_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = processing_job.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        ))
    );

CREATE POLICY "Users can create org processing jobs" 
    ON processing_job FOR INSERT 
    WITH CHECK (
        (document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = processing_job.document_id 
            AND user_has_org_access(document.organization_id)
        )) OR
        (mentor_bot_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = processing_job.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        ))
    );

CREATE POLICY "Users can update org processing jobs" 
    ON processing_job FOR UPDATE 
    USING (
        (document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = processing_job.document_id 
            AND user_has_org_access(document.organization_id)
        )) OR
        (mentor_bot_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = processing_job.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        ))
    );

CREATE POLICY "Users can delete org processing jobs" 
    ON processing_job FOR DELETE 
    USING (
        (document_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM document 
            WHERE document.id = processing_job.document_id 
            AND user_has_org_access(document.organization_id)
        )) OR
        (mentor_bot_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = processing_job.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        ))
    );

-- Conversation policies
CREATE POLICY "Users can view their conversations" 
    ON conversation FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations with accessible bots" 
    ON conversation FOR INSERT 
    WITH CHECK (
        user_id = auth.uid() AND 
        EXISTS (
            SELECT 1 FROM mentor_bot 
            WHERE mentor_bot.id = conversation.mentor_bot_id 
            AND user_has_org_access(mentor_bot.organization_id)
        )
    );

CREATE POLICY "Users can update their conversations" 
    ON conversation FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their conversations" 
    ON conversation FOR DELETE 
    USING (user_id = auth.uid());

-- Message policies
CREATE POLICY "Users can view their messages" 
    ON message FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM conversation 
            WHERE conversation.id = message.conversation_id 
            AND conversation.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in their conversations" 
    ON message FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversation 
            WHERE conversation.id = message.conversation_id 
            AND conversation.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their messages" 
    ON message FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM conversation 
            WHERE conversation.id = message.conversation_id 
            AND conversation.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their messages" 
    ON message FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM conversation 
            WHERE conversation.id = message.conversation_id 
            AND conversation.user_id = auth.uid()
        )
    );

-- ============================================
-- GRANT PERMISSIONS FOR SERVICE FUNCTIONS
-- ============================================

-- Grant execute permissions to authenticated users (your backend)
GRANT EXECUTE ON FUNCTION service_update_document_status TO authenticated;
GRANT EXECUTE ON FUNCTION service_create_document_chunk TO authenticated;