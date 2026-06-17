export interface MemoryEntry {
  id: string;
  userId: string;
  sessionId?: string;
  projectId?: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, any>;
  embedding?: number[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum MemoryType {
  SESSION = "session",
  PROJECT = "project",
  USER_PROFILE = "user_profile",
  SEMANTIC = "semantic",
}

export interface MemoryQuery {
  userId: string;
  sessionId?: string;
  projectId?: string;
  type?: MemoryType;
  limit?: number;
  query?: string;
}

export interface MemoryStore {
  add(entry: MemoryEntry): Promise<void>;
  get(id: string): Promise<MemoryEntry | null>;
  query(query: MemoryQuery): Promise<MemoryEntry[]>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<void>;
  delete(id: string): Promise<void>;
  clearSession(sessionId: string): Promise<void>;
  clearProject(projectId: string): Promise<void>;
}
