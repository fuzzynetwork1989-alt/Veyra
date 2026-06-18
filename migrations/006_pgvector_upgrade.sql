-- Re-apply pgvector setup when switching from plain postgres to pgvector/pgvector image.
-- Migration 004 may have been recorded while the extension was unavailable.
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension unavailable: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
        ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(768);
        CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
            ON document_chunks USING hnsw (embedding vector_cosine_ops);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector column/index setup skipped: %', SQLERRM;
END $$;