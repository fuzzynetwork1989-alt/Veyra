import { Task, Plan, PlanStep } from "./types";

export class Planner {
  async plan(task: Task): Promise<Plan> {
    const steps = await this.decomposeTask(task);
    
    return {
      taskId: task.id,
      steps,
      estimatedDuration: this.estimateDuration(steps),
      requiredTools: this.extractRequiredTools(steps),
      dependencies: this.extractDependencies(steps),
      createdAt: new Date(),
    };
  }

  private async decomposeTask(task: Task): Promise<PlanStep[]> {
    const steps: PlanStep[] = [];
    const description = task.description.toLowerCase();
    
    // Simple heuristic-based decomposition
    if (description.includes("create") || description.includes("build")) {
      steps.push({
        id: `${task.id}-step-1`,
        description: "Analyze requirements",
        action: "analyze",
        parameters: { context: task.context },
        dependencies: [],
      });
      
      steps.push({
        id: `${task.id}-step-2`,
        description: "Generate implementation plan",
        action: "generate_plan",
        parameters: { requirements: task.context },
        dependencies: [`${task.id}-step-1`],
      });
      
      steps.push({
        id: `${task.id}-step-3`,
        description: "Execute implementation",
        action: "execute",
        parameters: { plan: "from_step_2" },
        dependencies: [`${task.id}-step-2`],
      });
    } else if (description.includes("search") || description.includes("find")) {
      steps.push({
        id: `${task.id}-step-1`,
        description: "Search for information",
        action: "search",
        parameters: { query: task.description },
        dependencies: [],
      });
      
      steps.push({
        id: `${task.id}-step-2`,
        description: "Process and summarize results",
        action: "summarize",
        parameters: { results: "from_step_1" },
        dependencies: [`${task.id}-step-1`],
      });
    } else {
      // Generic task decomposition
      steps.push({
        id: `${task.id}-step-1`,
        description: "Understand the task",
        action: "understand",
        parameters: { task: task.description },
        dependencies: [],
      });
      
      steps.push({
        id: `${task.id}-step-2`,
        description: "Execute the task",
        action: "execute",
        parameters: { context: task.context },
        dependencies: [`${task.id}-step-1`],
      });
    }
    
    return steps;
  }

  private estimateDuration(steps: PlanStep[]): number {
    // Simple estimation: 30 seconds per step
    return steps.length * 30;
  }

  private extractRequiredTools(steps: PlanStep[]): string[] {
    const tools = new Set<string>();
    
    for (const step of steps) {
      if (step.action === "search") tools.add("web_search");
      if (step.action === "execute") tools.add("code_exec");
      if (step.action === "analyze") tools.add("analyzer");
    }
    
    return Array.from(tools);
  }

  private extractDependencies(steps: PlanStep[]): string[] {
    const dependencies = new Set<string>();
    
    for (const step of steps) {
      for (const dep of step.dependencies) {
        dependencies.add(dep);
      }
    }
    
    return Array.from(dependencies);
  }
}
