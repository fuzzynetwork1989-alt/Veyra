-- Optional pgvector upgrade for faster similarity search (requires pgvector/pgvector image)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pgvector extension unavailable; continuing with JSONB embeddings';
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