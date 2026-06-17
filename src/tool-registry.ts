import { App } from "obsidian";
import { ToolDefinition } from "./types";

export type ToolHandler = (
  app: App,
  args: Record<string, unknown>
) => Promise<string>;

interface ToolEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
}

const toolMap = new Map<string, ToolEntry>();

export function registerTool(
  definition: ToolDefinition,
  handler: ToolHandler
): void {
  toolMap.set(definition.name, { definition, handler });
}

export function getToolDefinitions(): ToolDefinition[] {
  return Array.from(toolMap.values()).map((e) => e.definition);
}

export async function executeTool(
  app: App,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const entry = toolMap.get(name);
  if (!entry) return JSON.stringify({ error: `Unknown tool: ${name}` });

  try {
    const result = await entry.handler(app, args);
    if (typeof result === "string") return result;
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
