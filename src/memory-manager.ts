import type { Memory, MemoryCategory, PluginSettings } from "./types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class MemoryManager {
  private settings: PluginSettings;

  constructor(settings: PluginSettings) {
    this.settings = settings;
    if (!settings.memories) settings.memories = [];
  }

  add(content: string, category: MemoryCategory = "other", tags: string[] = []): Memory {
    const memory: Memory = {
      id: generateId(),
      content: content.trim(),
      category,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.settings.memories!.push(memory);
    this.enforceLimit();
    return memory;
  }

  update(id: string, content: string): Memory | null {
    const memory = this.settings.memories!.find((m) => m.id === id);
    if (!memory) return null;
    memory.content = content.trim();
    memory.updatedAt = Date.now();
    return memory;
  }

  delete(id: string): boolean {
    const idx = this.settings.memories!.findIndex((m) => m.id === id);
    if (idx === -1) return false;
    this.settings.memories!.splice(idx, 1);
    return true;
  }

  search(query: string, limit = 10): Memory[] {
    const lower = query.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);

    return this.settings.memories!
      .map((m) => {
        const content = m.content.toLowerCase();
        const tags = m.tags.join(" ").toLowerCase();
        const cat = m.category.toLowerCase();
        let score = 0;
        for (const word of words) {
          if (content.includes(word)) score += 3;
          if (tags.includes(word)) score += 2;
          if (cat.includes(word)) score += 1;
        }
        return { memory: m, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.memory);
  }

  list(category?: MemoryCategory, limit = 20): Memory[] {
    const memories = category
      ? this.settings.memories!.filter((m) => m.category === category)
      : this.settings.memories!;
    return memories
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  getRecent(limit = 15): Memory[] {
    return this.settings.memories!
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  formatForContext(limit = 15): string {
    const memories = this.getRecent(limit);
    if (memories.length === 0) return "";

    const lines = memories.map((m) => {
      const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
      return `- (${m.category})${tags} ${m.content}`;
    });
    return `## User Memories\nYou have persistent memories about this user. Use them to provide personalized responses.\n\n${lines.join("\n")}`;
  }

  count(): number {
    return this.settings.memories!.length;
  }

  private enforceLimit(): void {
    const max = this.settings.maxMemories || 200;
    if (this.settings.memories!.length <= max) return;
    this.settings.memories!.sort((a, b) => b.updatedAt - a.updatedAt);
    this.settings.memories!.length = max;
  }
}
