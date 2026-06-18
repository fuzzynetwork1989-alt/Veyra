import { useMemo, useState, useCallback } from "react";
import { VeyraClient, ChatOptions, ChatResponse } from "./client";

export function useVeyraClient(config: { apiKey?: string; baseUrl: string }) {
  const client = useMemo(
    () => new VeyraClient(config),
    [config.apiKey, config.baseUrl]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const chat = useCallback(
    async (message: string, options?: ChatOptions): Promise<ChatResponse> => {
      setLoading(true);
      setError(null);

      try {
        const response = await client.chat(message, options);
        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const addMemory = useCallback(
    async (documents: string[], metadata?: Record<string, any>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await client.addMemory(documents, metadata);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const retrieveMemory = useCallback(
    async (query: string, topK?: number) => {
      setLoading(true);
      setError(null);

      try {
        return await client.retrieveMemory(query, topK);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const executeTask = useCallback(
    async (task: string, context?: Record<string, any>) => {
      setLoading(true);
      setError(null);

      try {
        return await client.executeTask(task, context);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  return {
    client,
    chat,
    addMemory,
    retrieveMemory,
    executeTask,
    loading,
    error,
  };
}