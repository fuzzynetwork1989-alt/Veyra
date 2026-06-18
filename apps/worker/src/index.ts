import "./env";
import Redis from "ioredis";
import { AgentRuntime, Task, TaskStatus } from "@veyra/agent-runtime";
import { updateTaskStatus, closeDatabase } from "./db";
import { builtinTools } from "./tools";
import { startMetricsServer, tasksProcessed, taskDuration } from "./metrics";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const queueKey = "veyra:tasks:queue";
const processingKey = "veyra:tasks:processing";
const runtime = new AgentRuntime();

for (const tool of builtinTools) {
  runtime.registerTool(tool);
}

interface QueueTask {
  id: string;
  userId: string;
  projectId?: string | null;
  description: string;
  context: Record<string, unknown>;
  priority: string;
}

async function processTask(payload: QueueTask) {
  const started = Date.now();
  console.log(`Processing task: ${payload.id}`);
  await updateTaskStatus(payload.id, "running");

  const task: Task = {
    id: payload.id,
    description: payload.description,
    context: payload.context,
    userId: payload.userId,
    projectId: payload.projectId || undefined,
    priority: (payload.priority as Task["priority"]) || "medium",
    status: TaskStatus.IN_PROGRESS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const outcome = await runtime.executeTask(task, {
      task,
      executionResults: [],
      verificationResults: [],
      memory: { task: payload.description },
      retrieval: { projectId: payload.projectId },
    });

    await updateTaskStatus(payload.id, "completed", {
      plan: outcome.plan,
      results: outcome.results,
      verification: outcome.verification,
    });
    tasksProcessed.inc({ status: "completed" });
    console.log(`Task ${payload.id} completed successfully`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Task ${payload.id} failed:`, message);
    await updateTaskStatus(payload.id, "failed", undefined, message);
    tasksProcessed.inc({ status: "failed" });
  } finally {
    taskDuration.observe((Date.now() - started) / 1000);
  }
}

async function workerLoop() {
  console.log("Veyra Worker started");
  startMetricsServer(Number(process.env.METRICS_PORT || "8001"));

  while (true) {
    try {
      const result = await redis.brpop(queueKey, 5);
      if (!result) {
        continue;
      }

      const payload = JSON.parse(result[1]) as QueueTask;
      await redis.sadd(processingKey, payload.id);
      await processTask(payload);
      await redis.srem(processingKey, payload.id);
    } catch (error) {
      console.error("Worker error:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function shutdown() {
  console.log("Shutting down worker...");
  await redis.quit();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

workerLoop().catch(console.error);