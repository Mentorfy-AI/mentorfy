-- Migration: Add Import → Enrich → Ingest Pipeline Support
-- Description: Adds support for multi-phase document processing with contextual chunking
-- Date: 2025-01-02

-- ============================================================================
-- PART 1: Document Table - Source Type Enum
-- ============================================================================

-- Create source_type enum
CREATE TYPE source_type AS ENUM (
  'manual_upload',
  'youtube',
  'google_drive',
  'fathom',
  'fireflies',
  'read_ai'
);

-- Convert existing source_type column to enum
-- First, set all existing documents to 'google_drive' (user's request)
UPDATE document SET source_type = 'google_drive' WHERE source_type IS NULL OR source_type = 'manual_upload';

-- Drop existing default before type conversion
ALTER TABLE document ALTER COLUMN source_type DROP DEFAULT;

-- Now convert the column to enum type
ALTER TABLE document
  ALTER COLUMN source_type TYPE source_type
  USING source_type::source_type;

-- Set new enum default
ALTER TABLE document
  ALTER COLUMN source_type SET DEFAULT 'manual_upload'::source_type;

-- ============================================================================
-- PART 2: Document Table - New Columns
-- ============================================================================

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS ready_for_ingest BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS import_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ingest_completed_at TIMESTAMPTZ;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_document_source_type ON document(source_type);
CREATE INDEX IF NOT EXISTS idx_document_ready_for_ingest ON document(ready_for_ingest) WHERE ready_for_ingest = true;

-- ============================================================================
-- PART 3: Processing Status Enum - Add New Values
-- ============================================================================

-- Add new processing status values for phased pipeline
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'importing';        -- Fetching from external source
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'import_complete';  -- Text extracted, ready for chunking
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'chunk_complete';   -- Chunks created, ready for ingest
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'ingesting';        -- Adding to knowledge graph
ALTER TYPE processing_status ADD VALUE IF NOT EXISTS 'ingest_complete';  -- Fully processed

-- Note: 'available_to_ai' will be deprecated in favor of 'ingest_complete' but kept for backward compatibility

-- ============================================================================
-- PART 4: Document Chunk Table - Contextual Retrieval Support
-- ============================================================================

-- Add context column for Anthropic's contextual retrieval pattern
ALTER TABLE document_chunk
  ADD COLUMN IF NOT EXISTS context TEXT;

-- Ensure cascade delete for provenance (CRITICAL)
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_chunk_document_id_fkey'
  ) THEN
    ALTER TABLE document_chunk DROP CONSTRAINT document_chunk_document_id_fkey;
  END IF;

  -- Add constraint with CASCADE delete
  ALTER TABLE document_chunk
    ADD CONSTRAINT document_chunk_document_id_fkey
    FOREIGN KEY (document_id)
    REFERENCES document(id)
    ON DELETE CASCADE;
END $$;

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_document_chunk_document_id ON document_chunk(document_id);

-- ============================================================================
-- PART 5: KG Provider Enum
-- ============================================================================

-- Create KG provider enum for multi-provider support
CREATE TYPE kg_provider AS ENUM (
  'graphiti',
  'supermemory'
);

-- ============================================================================
-- PART 6: Rename Episode Mappings → KG Entity Mapping
-- ============================================================================

-- Rename table to be provider-agnostic
ALTER TABLE episode_mappings RENAME TO kg_entity_mapping;

-- Rename column to be provider-agnostic
ALTER TABLE kg_entity_mapping RENAME COLUMN episode_uuid TO entity_id;

-- Convert document_id from TEXT to UUID to match document.id type
ALTER TABLE kg_entity_mapping
  ALTER COLUMN document_id TYPE UUID USING document_id::uuid;

-- Clean up orphaned records (documents that no longer exist)
DELETE FROM kg_entity_mapping
WHERE document_id NOT IN (SELECT id FROM document);

-- Add new columns
ALTER TABLE kg_entity_mapping
  ADD COLUMN IF NOT EXISTS provider kg_provider DEFAULT 'graphiti'::kg_provider,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS source_chunk_ids TEXT[];

-- Add proper foreign key for cascade deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'kg_entity_mapping_document_id_fkey'
  ) THEN
    ALTER TABLE kg_entity_mapping
      ADD CONSTRAINT kg_entity_mapping_document_id_fkey
      FOREIGN KEY (document_id)
      REFERENCES document(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_kg_entity_mapping_document_id ON kg_entity_mapping(document_id);
CREATE INDEX IF NOT EXISTS idx_kg_entity_mapping_entity_id ON kg_entity_mapping(entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_entity_mapping_org_id ON kg_entity_mapping(organization_id);
CREATE INDEX IF NOT EXISTS idx_kg_entity_mapping_provider ON kg_entity_mapping(provider);
CREATE INDEX IF NOT EXISTS idx_kg_entity_mapping_source_chunk_ids ON kg_entity_mapping USING GIN(source_chunk_ids);

-- Enable RLS if not already enabled
ALTER TABLE kg_entity_mapping ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS kg_entity_mapping_org_isolation ON kg_entity_mapping;

CREATE POLICY kg_entity_mapping_org_isolation ON kg_entity_mapping
  USING (organization_id = current_setting('request.jwt.claims', true)::json->>'org_id');

-- ============================================================================
-- PART 7: Job Type Enum - Add New Values
-- ============================================================================

-- Add new job types for phased processing
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'import_document';   -- Phase 1: Import from source
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'chunk_document';    -- Phase 1: Create chunks
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'enrich_document';   -- Phase 2: Enrichment (future)
ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'ingest_document';   -- Phase 3: KG ingestion

-- ============================================================================
-- PART 8: Processing Job Table - Add Phase Column
-- ============================================================================

-- Add phase tracking column
ALTER TABLE processing_job
  ADD COLUMN IF NOT EXISTS phase TEXT
  CHECK (phase IN ('import', 'enrich', 'ingest'));

-- ============================================================================
-- PART 9: Backward Compatibility - Update Existing Data
-- ============================================================================

-- Mark existing documents as ready for ingest (they're already processed)
UPDATE document
SET
  ready_for_ingest = true,
  ingest_completed_at = updated_at
WHERE processing_status = 'available_to_ai';

-- Set provider for all existing KG entity mappings
UPDATE kg_entity_mapping
SET provider = 'graphiti'::kg_provider
WHERE provider IS NULL;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - run manually to verify)
-- ============================================================================

-- Verify source_type enum
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'source_type'::regtype ORDER BY enumsortorder;

-- Verify processing_status enum
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'processing_status'::regtype ORDER BY enumsortorder;

-- Verify kg_provider enum
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'kg_provider'::regtype ORDER BY enumsortorder;

-- Verify job_type enum
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'job_type'::regtype ORDER BY enumsortorder;

-- Verify kg_entity_mapping table structure
-- \d kg_entity_mapping

-- Verify document table structure
-- \d document

-- Verify document_chunk constraints
-- SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'document_chunk'::regclass;
