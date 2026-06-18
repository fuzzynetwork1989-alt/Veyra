import { Tool } from "@veyra/agent-runtime";
import { completeChat } from "./llm";

const AGENT_SYSTEM = (
  "You are Veyra, a developer-first AI agent. Produce practical, actionable output. " +
  "Be concise but complete. Use markdown when helpful."
);

function makeLlmTool(
  name: string,
  description: string,
  instruction: string,
  maxTokens = 1024
): Tool {
  return {
    name,
    description,
    schema: {
      type: "object",
      properties: {
        task: { type: "string" },
        context: { type: "object" },
      },
    },
    permissions: ["user"],
    execute: async (params: Record<string, unknown>) => {
      const task = String(
        params.task || params.description || params.query || "No task provided"
      );
      const context = params.context ? JSON.stringify(params.context, null, 2) : "{}";

      const result = await completeChat(
        AGENT_SYSTEM,
        `${instruction}\n\nTask:\n${task}\n\nContext:\n${context}`,
        { maxTokens, temperature: name === "execute" ? 0.3 : 0.5 }
      );

      return {
        action: name,
        summary: result.content,
        model: result.model,
        tokens_used: result.tokensUsed,
        params,
      };
    },
  };
}

export const builtinTools: Tool[] = [
  makeLlmTool(
    "understand",
    "Understand and restate the task requirements",
    "Analyze the task and produce: goals, constraints, assumptions, and open questions."
  ),
  makeLlmTool(
    "analyze",
    "Analyze requirements and technical approach",
    "Analyze requirements. Return risks, dependencies, and a recommended technical approach."
  ),
  makeLlmTool(
    "search",
    "Research and gather relevant information",
    "Research the task domain. Return key facts, references, and considerations."
  ),
  makeLlmTool(
    "generate_plan",
    "Generate a step-by-step implementation plan",
    "Create a numbered implementation plan with concrete steps, tools, and verification criteria.",
    1536
  ),
  makeLlmTool(
    "execute",
    "Execute the implementation plan",
    "Execute the plan. Return code snippets, commands, configuration changes, and rationale.",
    2048
  ),
  makeLlmTool(
    "summarize",
    "Summarize results and next steps",
    "Summarize what was done, outcomes, remaining work, and recommended next actions."
  ),
];