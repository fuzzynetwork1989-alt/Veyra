export interface EvaluationResult {
  taskId: string;
  timestamp: Date;
  metrics: EvaluationMetrics;
}

export interface EvaluationMetrics {
  taskCompletion: TaskCompletionMetrics;
  groundedness: GroundednessMetrics;
  retrievalQuality: RetrievalQualityMetrics;
}

export interface TaskCompletionMetrics {
  success: boolean;
  completeness: number; // 0-1
  errorCount: number;
  duration: number; // milliseconds
}

export interface GroundednessMetrics {
  score: number; // 0-1
  hallucinationCount: number;
  citationAccuracy: number; // 0-1
}

export interface RetrievalQualityMetrics {
  relevanceScore: number; // 0-1
  freshnessScore: number; // 0-1
  coverageScore: number; // 0-1
  duplicateCount: number;
}

export interface EvaluationConfig {
  minGroundednessScore: number;
  minRetrievalRelevance: number;
  maxHallucinationRate: number;
}
