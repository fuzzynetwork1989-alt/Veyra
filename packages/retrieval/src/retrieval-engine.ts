import Redis from "ioredis";
import { Document, SourceType, RetrievalQuery, RetrievalResult, RetrievalEngine } from "./types";
import { chunkText } from "./chunking";

export class HybridRetrievalEngine implements RetrievalEngine {
  private redis: Redis;
  private prefix: string = "veyra:retrieval:";
  private chunkingStrategy = { chunkSize: 1000, overlap: 200, strategy: "semantic" as const };

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
  }

  async addDocument(document: Document): Promise<void> {
    const chunks = chunkText(document.content, this.chunkingStrategy);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunkDoc: Document = {
        ...document,
        id: `${document.id}-chunk-${i}`,
        chunkId: `${document.id}-chunk-${i}`,
        content: chunks[i],
        freshnessScore: this.calculateFreshness(document),
      };

      const key = this.prefix + chunkDoc.id;
      await this.redis.set(key, JSON.stringify(chunkDoc));
      
      // Index by source
      await this.redis.sadd(`${this.prefix}source:${document.source}`, chunkDoc.id);
    }
  }

  async addDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      await this.addDocument(doc);
    }
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const results: RetrievalResult[] = [];
    
    // Get all document keys
    const keys = await this.redis.keys(`${this.prefix}*`);
    
    for (const key of keys) {
      if (key.includes("source:")) continue;
      
      const data = await this.redis.get(key);
      if (!data) continue;
      
      const document = JSON.parse(data) as Document;
      
      // Filter by source
      if (query.sources && !query.sources.includes(document.source)) {
        continue;
      }
      
      // Filter by freshness
      if (query.minFreshness && (document.freshnessScore || 0) < query.minFreshness) {
        continue;
      }
      
      // Filter by metadata
      if (query.filters) {
        let matches = true;
        for (const [key, value] of Object.entries(query.filters)) {
          if (document.metadata[key] !== value) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      }
      
      // Calculate relevance score (simple text matching for now)
      const score = this.calculateRelevance(query.query, document.content);
      
      results.push({
        document,
        score,
        relevance: score,
        citation: this.generateCitation(document),
      });
    }
    
    // Sort by score and return topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, query.topK || 10);
  }

  async deleteDocument(id: string): Promise<void> {
    // Delete all chunks for this document
    const keys = await this.redis.keys(`${this.prefix}${id}-chunk-*`);
    for (const key of keys) {
      await this.redis.del(key);
    }
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    // Delete and re-add with updates
    await this.deleteDocument(id);
    const document = { ...updates, id } as Document;
    await this.addDocument(document);
  }

  async reindexSource(source: SourceType): Promise<void> {
    // Get all documents for this source
    const chunkIds = await this.redis.smembers(`${this.prefix}source:${source}`);
    
    for (const chunkId of chunkIds) {
      const data = await this.redis.get(`${this.prefix}${chunkId}`);
      if (data) {
        const document = JSON.parse(data) as Document;
        // Re-calculate freshness and re-save
        document.freshnessScore = this.calculateFreshness(document);
        await this.redis.set(`${this.prefix}${chunkId}`, JSON.stringify(document));
      }
    }
  }

  async invalidateSource(source: SourceType): Promise<void> {
    const chunkIds = await this.redis.smembers(`${this.prefix}source:${source}`);
    
    for (const chunkId of chunkIds) {
      await this.redis.del(`${this.prefix}${chunkId}`);
    }
    
    await this.redis.del(`${this.prefix}source:${source}`);
  }

  private calculateFreshness(document: Document): number {
    const now = new Date();
    const age = now.getTime() - document.updatedAt.getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    // Freshness score from 0 to 1, where 1 is most fresh
    return Math.max(0, 1 - age / maxAge);
  }

  private calculateRelevance(query: string, content: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    // Simple word overlap scoring
    const queryWords = queryLower.split(/\s+/);
    let matches = 0;
    
    for (const word of queryWords) {
      if (contentLower.includes(word)) {
        matches++;
      }
    }
    
    return matches / queryWords.length;
  }

  private generateCitation(document: Document): string {
    if (document.url) {
      return `[${document.source}] ${document.url}`;
    }
    return `[${document.source}] ${document.id}`;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
