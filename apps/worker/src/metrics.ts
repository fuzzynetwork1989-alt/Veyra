import http from "http";
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const tasksProcessed = new client.Counter({
  name: "veyra_worker_tasks_processed_total",
  help: "Tasks processed by worker",
  labelNames: ["status"],
  registers: [register],
});

export const taskDuration = new client.Histogram({
  name: "veyra_worker_task_duration_seconds",
  help: "Task processing duration",
  registers: [register],
});

export function startMetricsServer(port = 8001): void {
  const server = http.createServer(async (_req, res) => {
    res.setHeader("Content-Type", register.contentType);
    res.end(await register.metrics());
  });
  server.listen(port, () => {
    console.log(`Worker metrics on :${port}/metrics`);
  });
}