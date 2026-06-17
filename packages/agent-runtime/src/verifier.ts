import { Task, ExecutionResult, VerificationResult } from "./types";

export class Verifier {
  async verify(task: Task, results: ExecutionResult[]): Promise<VerificationResult> {
    const issues: string[] = [];
    let grounded = true;
    let complete = true;
    let score = 1.0;

    // Check if all steps succeeded
    const failedSteps = results.filter(r => !r.success);
    if (failedSteps.length > 0) {
      grounded = false;
      issues.push(`${failedSteps.length} steps failed`);
      score -= 0.5;
    }

    // Check if output is present
    const hasOutput = results.some(r => r.success && r.output !== null);
    if (!hasOutput) {
      complete = false;
      issues.push("No output generated");
      score -= 0.3;
    }

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      issues.push(`Errors encountered: ${errors.map(e => e.error).join(", ")}`);
      score -= 0.2;
    }

    // Ensure score is non-negative
    score = Math.max(0, score);

    return {
      taskId: task.id,
      passed: grounded && complete && issues.length === 0,
      grounded,
      complete,
      issues,
      score,
      timestamp: new Date(),
    };
  }
}
