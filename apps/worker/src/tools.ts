import { Tool } from "@veyra/agent-runtime";

function makeTool(name: string, description: string): Tool {
  return {
    name,
    description,
    schema: {},
    permissions: ["user"],
    execute: async (params: Record<string, unknown>) => ({
      action: name,
      summary: `Completed ${name} step`,
      params,
    }),
  };
}

export const builtinTools: Tool[] = [
  makeTool("analyze", "Analyze requirements"),
  makeTool("generate_plan", "Generate implementation plan"),
  makeTool("execute", "Execute implementation"),
  makeTool("search", "Search for information"),
  makeTool("summarize", "Summarize results"),
  makeTool("understand", "Understand the task"),
];