import { Task, AgentContext, Plan, ExecutionResult, VerificationResult } from "./types";
import { Planner } from "./planner";
import { Executor } from "./executor";
import { Verifier } from "./verifier";
import { ToolBroker } from "./tool-broker";
import { MemoryManager } from "./memory-manager";
import { FallbackManager } from "./fallback-manager";

export class AgentRuntime {
  private planner: Planner;
  private executor: Executor;
  private verifier: Verifier;
  private toolBroker: ToolBroker;
  private memoryManager: MemoryManager;
  private fallbackManager: FallbackManager;

  constructor() {
    this.planner = new Planner();
    this.executor = new Executor();
    this.verifier = new Verifier();
    this.toolBroker = new ToolBroker();
    this.memoryManager = new MemoryManager();
    this.fallbackManager = new FallbackManager();
  }

  async executeTask(task: Task, context: AgentContext): Promise<{
    plan: Plan;
    results: ExecutionResult[];
    verification: VerificationResult;
  }> {
    // Enrich context with memory
    const enrichedContext = await this.memoryManager.enrichContext(task, context);
    
    // Plan the task
    const plan = await this.planner.plan(task);
    
    // Execute the plan
    let results: ExecutionResult[] = [];
    try {
      results = await this.executor.executePlan(plan, enrichedContext);
    } catch (error) {
      // Handle failure with fallback
      const fallback = await this.fallbackManager.handleFailure(
        task,
        results,
        error as Error
      );
      
      if (fallback.shouldRetry && fallback.fallbackAction) {
        results = await this.fallbackManager.executeFallback(
          fallback.fallbackAction,
          task
        );
      } else {
        throw error;
      }
    }

    // Store successful outputs in memory
    for (const result of results) {
      if (result.success && this.memoryManager.shouldStore(result.output)) {
        await this.memoryManager.storeMemory(
          result.stepId,
          result.output,
          "session",
          task.sessionId || "default"
        );
      }
    }

    // Verify the results
    const verification = await this.verifier.verify(task, results);

    return {
      plan,
      results,
      verification,
    };
  }

  registerTool(tool: any): void {
    this.executor.registerTool(tool);
    this.toolBroker.registerTool(tool);
  }

  setPermissions(userId: string, permissions: string[]): void {
    this.toolBroker.setPermissions(userId, permissions);
  }
}
