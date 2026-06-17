export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  source: SourceType;
  url?: string;
  embedding?: number[];
  chunkId?: string;
  createdAt: Date;
  updatedAt: Date;
  freshnessScore?: number;
}

export enum SourceType {
  UPLOADED_FILE = "uploaded_file",
  INTERNAL_DOC = "internal_doc",
  EXTERNAL_URL = "external_url",
  KNOWLEDGE_SOURCE = "knowledge_source",
  ENTERPRISE_CONNECTOR = "enterprise_connector",
}

export interface RetrievalQuery {
  query: string;
  sources?: SourceType[];
  filters?: Record<string, any>;
  topK?: number;
  minFreshness?: number;
  rerank?: boolean;
}

export interface RetrievalResult {
  document: Document;
  score: number;
  relevance: number;
  citation?: string;
}

export interface ChunkingStrategy {
  chunkSize: number;
  overlap: number;
  strategy: "fixed" | "semantic" | "recursive";
}

export interface RetrievalEngine {
  addDocument(document: Document): Promise<void>;
  addDocuments(documents: Document[]): Promise<void>;
  retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>;
  deleteDocument(id: string): Promise<void>;
  updateDocument(id: string, updates: Partial<Document>): Promise<void>;
  reindexSource(source: SourceType): Promise<void>;
  invalidateSource(source: SourceType): Promise<void>;
}
