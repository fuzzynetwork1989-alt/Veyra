import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const queueKey = "veyra:tasks:queue";
const processingKey = "veyra:tasks:processing";

async function processTask(task: any) {
  console.log(`Processing task: ${task.id}`);
  
  try {
    // Simulate task processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`Task ${task.id} completed successfully`);
    
    // Move to completed queue
    await redis.lpush("veyra:tasks:completed", JSON.stringify({
      ...task,
      status: "completed",
      completedAt: new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Task ${task.id} failed:`, error);
    
    // Move to failed queue
    await redis.lpush("veyra:tasks:failed", JSON.stringify({
      ...task,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      failedAt: new Date().toISOString(),
    }));
  }
}

async function workerLoop() {
  console.log("Veyra Worker started");
  
  while (true) {
    try {
      // Blocking pop from the right side of the queue
      const result = await redis.brpop(queueKey, 5);
      
      if (result) {
        const task = JSON.parse(result[1]);
        
        // Add to processing set
        await redis.sadd(processingKey, task.id);
        
        await processTask(task);
        
        // Remove from processing set
        await redis.srem(processingKey, task.id);
      }
    } catch (error) {
      console.error("Worker error:", error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await redis.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await redis.quit();
  process.exit(0);
});

// Start worker
workerLoop().catch(console.error);
