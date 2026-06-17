import { ChunkingStrategy } from "./types";

export function chunkText(
  text: string,
  strategy: ChunkingStrategy
): string[] {
  switch (strategy.strategy) {
    case "fixed":
      return fixedChunk(text, strategy.chunkSize, strategy.overlap);
    case "semantic":
      return semanticChunk(text, strategy.chunkSize, strategy.overlap);
    case "recursive":
      return recursiveChunk(text, strategy.chunkSize, strategy.overlap);
    default:
      return fixedChunk(text, strategy.chunkSize, strategy.overlap);
  }
}

function fixedChunk(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}

function semanticChunk(text: string, chunkSize: number, overlap: number): string[] {
  // Split by paragraphs first, then combine
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = paragraph.slice(-overlap);
    }
    currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function recursiveChunk(text: string, chunkSize: number, overlap: number): string[] {
  // Try to split by meaningful delimiters first
  const delimiters = ["\n\n", "\n", ". ", "! ", "? "];
  
  for (const delimiter of delimiters) {
    if (text.includes(delimiter)) {
      const parts = text.split(delimiter);
      if (parts.length > 1) {
        const chunks: string[] = [];
        let currentChunk = "";

        for (const part of parts) {
          if (currentChunk.length + part.length + delimiter.length > chunkSize && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = part.slice(-overlap);
          }
          currentChunk += (currentChunk ? delimiter : "") + part;
        }

        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        return chunks;
      }
    }
  }

  // Fallback to fixed chunking
  return fixedChunk(text, chunkSize, overlap);
}
