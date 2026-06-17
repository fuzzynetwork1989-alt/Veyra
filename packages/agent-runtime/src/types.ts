export interface Task {
  id: string;
  description: string;
  context: Record<string, any>;
  userId: string;
  sessionId?: string;
  projectId?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  PENDING = "pending",
  PLANNED = "planned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  RETRYING = "retrying",
}

export interface Plan {
  taskId: string;
  steps: PlanStep[];
  estimatedDuration: number;
  requiredTools: string[];
  dependencies: string[];
  createdAt: Date;
}

export interface PlanStep {
  id: string;
  description: string;
  action: string;
  parameters: Record<string, any>;
  expectedOutput?: string;
  dependencies: string[];
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  output: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface VerificationResult {
  taskId: string;
  passed: boolean;
  grounded: boolean;
  complete: boolean;
  issues: string[];
  score: number;
  timestamp: Date;
}

export interface Tool {
  name: string;
  description: string;
  schema: Record<string, any>;
  execute: (params: Record<string, any>) => Promise<any>;
  permissions: string[];
}

export interface AgentContext {
  task: Task;
  plan?: Plan;
  executionResults: ExecutionResult[];
  verificationResults: VerificationResult[];
  memory: any;
  retrieval: any;
}
