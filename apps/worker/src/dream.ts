/**
 * Dreaming worker — periodic consolidation queue consumer.
 * Enqueues users for /cognitive/dream via API when COGNITIVE_DREAM_ENABLED=1.
 */

const DREAM_QUEUE = "veyra:dream:queue";
const DREAM_INTERVAL_MS = Number(process.env.DREAM_INTERVAL_MS || "3600000");

export async function enqueueDreamUser(redis: { lpush: (key: string, value: string) => Promise<number> }, userId: string) {
  return redis.lpush(DREAM_QUEUE, userId);
}

export function startDreamScheduler(
  redis: { brpop: (key: string, timeout: number) => Promise<[string, string] | null> },
  apiBase: string,
  apiToken?: string
) {
  if (process.env.COGNITIVE_DREAM_ENABLED !== "1") {
    console.log("Cognitive dream scheduler disabled (set COGNITIVE_DREAM_ENABLED=1)");
    return;
  }

  console.log(`Cognitive dream scheduler active (interval ${DREAM_INTERVAL_MS}ms)`);

  const loop = async () => {
    while (true) {
      try {
        const result = await redis.brpop(DREAM_QUEUE, 30);
        if (!result) continue;
        const userId = result[1];
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

        const response = await fetch(`${apiBase}/cognitive/dream`, {
          method: "POST",
          headers,
        });
        console.log(`Dream cycle for ${userId}: ${response.status}`);
      } catch (err) {
        console.error("Dream scheduler error:", err);
      }
    }
  };

  void loop();
}