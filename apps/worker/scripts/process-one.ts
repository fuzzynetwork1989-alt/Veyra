import "../src/env";
import { builtinTools } from "../src/tools";
import { updateTaskStatus, closeDatabase } from "../src/db";

interface QueueTask {
  id: string;
  userId: string;
  projectId?: string | null;
  description: string;
  context: Record<string, unknown>;
  priority: string;
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: tsx scripts/process-one.ts '<json>'");
    process.exit(1);
  }
  const payload = JSON.parse(raw) as QueueTask;
  await updateTaskStatus(payload.id, "running");
  const tool = builtinTools.find((t) => t.name === "understand") || builtinTools[0];
  const output = await tool.execute({
    task: payload.description,
    context: payload.context,
  });
  await updateTaskStatus(payload.id, "completed", { results: [output] });
  await closeDatabase();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});