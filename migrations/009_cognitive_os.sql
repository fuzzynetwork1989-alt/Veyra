-- Veyra Cognitive OS: temporal memory, dreaming, and orchestration trace

CREATE TABLE IF NOT EXISTS cognitive_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    macro_profile TEXT NOT NULL DEFAULT '',
    self_notes TEXT NOT NULL DEFAULT '',
    preferences JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS cognitive_meso_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary TEXT NOT NULL,
    themes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cognitive_meso_user
    ON cognitive_meso_summaries(user_id, period_end DESC);

CREATE TABLE IF NOT EXISTS cognitive_dream_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    sessions_processed INT NOT NULL DEFAULT 0,
    insights TEXT,
    profile_delta TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cognitive_dream_user
    ON cognitive_dream_cycles(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS cognitive_trace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(128),
    phase VARCHAR(64) NOT NULL,
    label VARCHAR(256) NOT NULL,
    detail TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cognitive_trace_session
    ON cognitive_trace_events(session_id, created_at);