-- Veyra Graph Runtime
-- Durable checkpoints for the LangGraph state machine (written at logical
-- boundaries, not every micro-step) plus a model-router decision log.

CREATE TABLE IF NOT EXISTS graph_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    final_state JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS graph_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id VARCHAR(255) NOT NULL,
    node VARCHAR(100) NOT NULL,
    step INTEGER NOT NULL DEFAULT 0,
    state JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS router_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    thread_id VARCHAR(255),
    purpose VARCHAR(50) NOT NULL,
    selected_model VARCHAR(255) NOT NULL,
    candidate_models JSONB,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_graph_runs_user_id ON graph_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_checkpoints_thread_id ON graph_checkpoints(thread_id);
CREATE INDEX IF NOT EXISTS idx_router_decisions_user_id ON router_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_router_decisions_thread_id ON router_decisions(thread_id);

CREATE TRIGGER update_graph_runs_updated_at BEFORE UPDATE ON graph_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
