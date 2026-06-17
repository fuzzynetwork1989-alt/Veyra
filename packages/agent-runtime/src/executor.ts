import { Plan, PlanStep, ExecutionResult, Tool, AgentContext } from "./types";

export class Executor {
  private tools: Map<string, Tool> = new Map();

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async executePlan(plan: Plan, context: AgentContext): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const stepResults = new Map<string, any>();

    // Execute steps in dependency order
    const orderedSteps = this.topologicalSort(plan.steps);

    for (const step of orderedSteps) {
      const startTime = Date.now();
      
      try {
        // Resolve dependencies
        const resolvedParams = this.resolveDependencies(step, stepResults);
        
        // Get the tool for this action
        const tool = this.tools.get(step.action);
        if (!tool) {
          throw new Error(`Tool not found: ${step.action}`);
        }

        // Execute the step
        const output = await tool.execute(resolvedParams);
        
        const result: ExecutionResult = {
          stepId: step.id,
          success: true,
          output,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
        
        results.push(result);
        stepResults.set(step.id, output);
      } catch (error) {
        const result: ExecutionResult = {
          stepId: step.id,
          success: false,
          output: null,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
          timestamp: new Date(),
        };
        
        results.push(result);
        
        // Stop execution on failure
        break;
      }
    }

    return results;
  }

  private topologicalSort(steps: PlanStep[]): PlanStep[] {
    const visited = new Set<string>();
    const result: PlanStep[] = [];
    const stepMap = new Map(steps.map(s => [s.id, s]));

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      
      const step = stepMap.get(stepId);
      if (!step) return;
      
      for (const dep of step.dependencies) {
        visit(dep);
      }
      
      result.push(step);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return result;
  }

  private resolveDependencies(step: PlanStep, stepResults: Map<string, any>): Record<string, any> {
    const resolved: Record<string, any> = { ...step.parameters };
    
    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === "string" && value.startsWith("from_step_")) {
        const stepId = value.replace("from_step_", "");
        resolved[key] = stepResults.get(stepId);
      }
    }
    
    return resolved;
  }
}
