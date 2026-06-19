import { App } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";
import { MemoryManager } from "../memory-manager";
import type { MemoryCategory } from "../types";

function getManager(): MemoryManager | null {
  const plugin = getPluginInstance();
  if (!plugin || !plugin.settings.enableMemory) return null;
  return new MemoryManager(plugin.settings);
}

registerTool(
  {
    name: "memory_add",
    description: "Save a fact or observation about the user to persistent memory. Use this to remember personal details, preferences, health info, academic progress, family context, etc.",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The fact or observation to remember",
        },
        category: {
          type: "string",
          description: "Category: personal, academic, health, family, social, or other",
        },
        tags: {
          type: "array",
          description: "Optional tags for organization (e.g. ['aarón', '1er año'])",
        },
      },
      required: ["content"],
    },
  },
  async (_app, args) => {
    const manager = getManager();
    if (!manager) return JSON.stringify({ error: "Memory is disabled in settings." });

    const content = String(args.content ?? "").trim();
    if (!content) return JSON.stringify({ error: "Missing content" });

    const validCategories: MemoryCategory[] = ["personal", "academic", "health", "family", "social", "other"];
    const category = validCategories.includes(args.category as MemoryCategory)
      ? (args.category as MemoryCategory)
      : "other";

    const tags = Array.isArray(args.tags)
      ? args.tags.map(String).filter(Boolean)
      : [];

    const memory = manager.add(content, category, tags);
    const plugin = getPluginInstance();
    if (plugin) await plugin.saveSettings();

    return JSON.stringify({ saved: true, id: memory.id, category: memory.category });
  }
);

registerTool(
  {
    name: "memory_search",
    description: "Search persistent memories about the user. Use this to recall past information, preferences, history, etc.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. student name, topic, keyword)",
        },
        limit: {
          type: "number",
          description: "Max results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  async (_app, args) => {
    const manager = getManager();
    if (!manager) return JSON.stringify({ error: "Memory is disabled in settings." });

    const query = String(args.query ?? "").trim();
    if (!query) return JSON.stringify({ error: "Missing query" });

    const limit = Number(args.limit) || 10;
    const results = manager.search(query, limit);

    return JSON.stringify({
      count: results.length,
      memories: results.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category,
        tags: m.tags,
        updatedAt: m.updatedAt,
      })),
    });
  }
);

registerTool(
  {
    name: "memory_list",
    description: "List all persistent memories, optionally filtered by category.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category: personal, academic, health, family, social, or other (omit for all)",
        },
        limit: {
          type: "number",
          description: "Max results (default: 20)",
        },
      },
      required: [],
    },
  },
  async (_app, args) => {
    const manager = getManager();
    if (!manager) return JSON.stringify({ error: "Memory is disabled in settings." });

    const validCategories: MemoryCategory[] = ["personal", "academic", "health", "family", "social", "other"];
    const category = validCategories.includes(args.category as MemoryCategory)
      ? (args.category as MemoryCategory)
      : undefined;

    const limit = Number(args.limit) || 20;
    const results = manager.list(category, limit);

    return JSON.stringify({
      count: results.length,
      total: manager.count(),
      memories: results.map((m) => ({
        id: m.id,
        content: m.content,
        category: m.category,
        tags: m.tags,
        updatedAt: m.updatedAt,
      })),
    });
  }
);

registerTool(
  {
    name: "memory_delete",
    description: "Delete a specific memory by its ID.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The memory ID to delete",
        },
      },
      required: ["id"],
    },
  },
  async (_app, args) => {
    const manager = getManager();
    if (!manager) return JSON.stringify({ error: "Memory is disabled in settings." });

    const id = String(args.id ?? "").trim();
    if (!id) return JSON.stringify({ error: "Missing id" });

    const deleted = manager.delete(id);
    if (!deleted) return JSON.stringify({ error: `Memory not found: ${id}` });

    const plugin = getPluginInstance();
    if (plugin) await plugin.saveSettings();

    return JSON.stringify({ deleted: true, id });
  }
);

registerTool(
  {
    name: "memory_update",
    description: "Update the content of an existing memory by its ID.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The memory ID to update",
        },
        content: {
          type: "string",
          description: "New content for the memory",
        },
      },
      required: ["id", "content"],
    },
  },
  async (_app, args) => {
    const manager = getManager();
    if (!manager) return JSON.stringify({ error: "Memory is disabled in settings." });

    const id = String(args.id ?? "").trim();
    const content = String(args.content ?? "").trim();
    if (!id || !content) return JSON.stringify({ error: "Missing id or content" });

    const updated = manager.update(id, content);
    if (!updated) return JSON.stringify({ error: `Memory not found: ${id}` });

    const plugin = getPluginInstance();
    if (plugin) await plugin.saveSettings();

    return JSON.stringify({ updated: true, id: updated.id });
  }
);
