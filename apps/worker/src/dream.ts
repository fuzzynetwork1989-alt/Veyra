/**
 * Dreaming worker — periodic consolidation via internal API.
 */

const DREAM_QUEUE = "veyra:dream:queue";
const DREAM_INTERVAL_MS = Number(process.env.DREAM_INTERVAL_MS || "3600000");
const SWEEP_INTERVAL_MS = Number(process.env.DREAM_SWEEP_INTERVAL_MS || "3600000");

export async function enqueueDreamUser(
  redis: { lpush: (key: string, value: string) => Promise<number> },
  userId: string
) {
  return redis.lpush(DREAM_QUEUE, userId);
}

export function startDreamConsumer(
  redis: { brpop: (key: string, timeout: number) => Promise<[string, string] | null> },
  apiBase: string,
  workerSecret: string
) {
  if (process.env.COGNITIVE_DREAM_ENABLED !== "1") {
    console.log("Cognitive dream scheduler disabled (set COGNITIVE_DREAM_ENABLED=1)");
    return;
  }

  console.log("Cognitive dream consumer active");

  const loop = async () => {
    while (true) {
      try {
        const result = await redis.brpop(DREAM_QUEUE, 30);
        if (!result) continue;
        const userId = result[1];

        const response = await fetch(`${apiBase}/cognitive/dream/internal`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Worker-Secret": workerSecret,
          },
          body: JSON.stringify({ user_id: userId }),
        });
        const body = await response.text();
        console.log(`Dream cycle for ${userId}: ${response.status} ${body.slice(0, 120)}`);
      } catch (err) {
        console.error("Dream consumer error:", err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };

  void loop();
}

export function startDreamSweeper(
  redis: { lpush: (key: string, value: string) => Promise<number> },
  listActiveUserIds: () => Promise<string[]>
) {
  if (process.env.COGNITIVE_DREAM_ENABLED !== "1") return;

  console.log(`Cognitive dream sweeper active (every ${SWEEP_INTERVAL_MS}ms)`);

  const sweep = async () => {
    try {
      const userIds = await listActiveUserIds();
      for (const userId of userIds) {
        await enqueueDreamUser(redis, userId);
      }
      if (userIds.length) {
        console.log(`Enqueued ${userIds.length} user(s) for dream consolidation`);
      }
    } catch (err) {
      console.error("Dream sweeper error:", err);
    }
  };

  void sweep();
  setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
}