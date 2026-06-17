import { Tool } from "./types";

export class ToolBroker {
  private tools: Map<string, Tool> = new Map();
  private permissions: Map<string, string[]> = new Map(); // userId -> permissions

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  async executeTool(
    toolName: string,
    params: Record<string, any>,
    userId: string
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    // Check permissions
    this.checkPermissions(toolName, userId);

    // Validate parameters against schema
    this.validateParams(params, tool.schema);

    // Execute the tool
    return await tool.execute(params);
  }

  private checkPermissions(toolName: string, userId: string): void {
    const userPermissions = this.permissions.get(userId) || [];
    const tool = this.tools.get(toolName);
    
    if (!tool) return;

    const hasPermission = tool.permissions.some(perm => 
      userPermissions.includes(perm)
    );

    if (!hasPermission) {
      throw new Error(`User ${userId} lacks permission for tool ${toolName}`);
    }
  }

  private validateParams(params: Record<string, any>, schema: Record<string, any>): void {
    // Simple schema validation
    for (const [key, spec] of Object.entries(schema)) {
      if (spec.required && !(key in params)) {
        throw new Error(`Required parameter missing: ${key}`);
      }
    }
  }

  setPermissions(userId: string, permissions: string[]): void {
    this.permissions.set(userId, permissions);
  }
}
