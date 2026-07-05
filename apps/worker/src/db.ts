import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function updateTaskStatus(
  taskId: string,
  status: "running" | "completed" | "failed",
  result?: Record<string, unknown>,
  error?: string
): Promise<void> {
  await pool.query(
    `
      UPDATE tasks
      SET status = $1::varchar(50),
          result = $2::jsonb,
          error = $3,
          completed_at = CASE
            WHEN $1::varchar(50) IN ('completed', 'failed') THEN CURRENT_TIMESTAMP
            ELSE completed_at
          END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4::uuid
    `,
    [status, result ? JSON.stringify(result) : null, error || null, taskId]
  );
}

export async function listActiveUserIds(days = 7): Promise<string[]> {
  const result = await pool.query(
    `
      SELECT DISTINCT cs.user_id::text AS user_id
      FROM chat_sessions cs
      WHERE cs.updated_at >= NOW() - ($1::text || ' days')::interval
      ORDER BY user_id
    `,
    [String(days)]
  );
  return result.rows.map((row: { user_id: string }) => row.user_id);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}