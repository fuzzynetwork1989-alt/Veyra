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
      SET status = $1,
          result = $2,
          error = $3,
          completed_at = CASE WHEN $1 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `,
    [status, result ? JSON.stringify(result) : null, error || null, taskId]
  );
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}