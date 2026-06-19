import { App } from "obsidian";
import {
  ChatMessage,
  StreamCallbacks,
  LLMProvider,
  ToolDefinition,
  ToolCall,
  PluginSettings,
} from "./types";
import { streamChat, callLLM } from "./llm-client";
import { executeTool, getToolDefinitions } from "./tool-registry";
import { trimMessages } from "./trim-messages";
import { MemoryManager } from "./memory-manager";

function buildSystemPrompt(custom?: string, settings?: PluginSettings): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const base = custom || `You are Neuro Vault, an AI agent inside Obsidian. You help users research, write, and manage their knowledge base.

You have access to tools that let you read files, search notes, and more. Use them when helpful.

Guidelines:
- Be concise and direct. The user is in a chat interface.
- When reading a file, summarize key points before quoting.
- When searching notes, present results clearly with file paths.
- If a tool fails, explain what went wrong and suggest alternatives.
- Never invent file paths or content. Only work with what the tools return.
- Respond in the same language the user uses.
- When you learn important facts about the user (preferences, personal details, context), save them using memory_add.`;

  let prompt = `${base}\n\nToday's date is ${dateStr}. Use this as your temporal reference for any date-related questions, research, or context.`;

  if (settings?.enableMemory && settings.memories?.length) {
    const manager = new MemoryManager(settings);
    const context = manager.formatForContext(15);
    if (context) {
      prompt += `\n\n${context}`;
    }
  }

  return prompt;
}

const MAX_TOOL_ITERATIONS = 5;
const CHAT_TOOLS = ["web_search"];

export class ChatEngine {
  private app: App;
  private messages: ChatMessage[] = [];
  private abortController: AbortController | null = null;
  private viewCallbacks: StreamCallbacks | null = null;
  private systemPrompt: string;
  private basePrompt: string;
  private settings?: PluginSettings;

  constructor(app: App, systemPrompt?: string, settings?: PluginSettings) {
    this.app = app;
    this.basePrompt = systemPrompt || "";
    this.settings = settings;
    this.systemPrompt = buildSystemPrompt(systemPrompt, settings);
    this.messages = [{ role: "system", content: this.systemPrompt }];
  }

  reset(): void {
    this.systemPrompt = buildSystemPrompt(this.basePrompt || undefined, this.settings);
    this.messages = [{ role: "system", content: this.systemPrompt }];
    this.abortController?.abort();
    this.abortController = null;
  }

  updateSettings(settings: PluginSettings): void {
    this.settings = settings;
  }

  setViewCallbacks(callbacks: StreamCallbacks): void {
    this.viewCallbacks = callbacks;
  }

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  isRunning(): boolean {
    return this.abortController !== null;
  }

  getMessages(): ChatMessage[] {
    return this.messages.filter((m) => m.role !== "system");
  }

  restoreMessages(saved: ChatMessage[]): void {
    this.messages = [
      { role: "system", content: this.systemPrompt },
      ...saved,
    ];
  }

  async send(
    userContent: string,
    provider: LLMProvider,
    apiKey: string,
    model: string,
    mode: "chat" | "agent" = "agent"
  ): Promise<void> {
    this.messages.push({ role: "user", content: userContent });
    this.trimHistory();
    this.abortController = new AbortController();
    await this.runLoop(provider, apiKey, model, this.abortController.signal, mode);
  }

  async retry(
    provider: LLMProvider,
    apiKey: string,
    model: string,
    mode: "chat" | "agent" = "agent"
  ): Promise<void> {
    this.abortController = new AbortController();
    await this.runLoop(provider, apiKey, model, this.abortController.signal, mode);
  }

  private async runLoop(
    provider: LLMProvider,
    apiKey: string,
    model: string,
    signal: AbortSignal,
    mode: "chat" | "agent" = "agent"
  ): Promise<void> {
    try {
      const allTools = getToolDefinitions();
      const tools = mode === "chat"
        ? allTools.filter((t) => CHAT_TOOLS.includes(t.name))
        : allTools;
      let iteration = 0;

      let toolLoopRunning = true;

      while (toolLoopRunning) {
        if (signal.aborted) break;
        iteration++;

        const pendingToolCalls: ToolCall[] = [];
        let assistantContent = "";

        const callbacks: StreamCallbacks = {
          onToken: (token) => {
            assistantContent += token;
            this.viewCallbacks?.onToken(token);
          },
          onToolCall: (name, args, id) => {
            pendingToolCalls.push({ id, name, arguments: args });
            this.viewCallbacks?.onToolCall(name, args, id);
          },
          onToolResult: (result) => {
            this.viewCallbacks?.onToolResult(result);
          },
          onDone: () => {},
          onError: (err) => {
            this.viewCallbacks?.onError(err);
          },
        };

        await streamChat(
          provider,
          apiKey,
          model,
          this.messages,
          tools,
          callbacks,
          signal
        );

        if (signal.aborted) break;

        this.messages.push({
          role: "assistant",
          content: assistantContent,
          ...(pendingToolCalls.length > 0 && { toolCalls: pendingToolCalls }),
        });

        if (pendingToolCalls.length === 0) {
          toolLoopRunning = false;
          break;
        }

        const toolResults = await Promise.all(
          pendingToolCalls.map(async (tc) => {
            const result = await executeTool(this.app, tc.name, tc.arguments);
            return { id: tc.id, name: tc.name, result };
          })
        );

        for (const tr of toolResults) {
          this.messages.push({
            role: "tool",
            content: tr.result,
            toolCallId: tr.id,
          });

          this.viewCallbacks?.onToolResult({
            toolCallId: tr.id,
            content: tr.result,
          });
        }
      }

      this.viewCallbacks?.onDone();
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        this.viewCallbacks?.onDone();
        return;
      }
      const lastIdx = this.messages.length - 1;
      if (lastIdx >= 0 && this.messages[lastIdx].role === "user") {
        this.messages.pop();
      }
      const errorMsg = e instanceof Error ? e.message : String(e);
      this.viewCallbacks?.onError(errorMsg);
    } finally {
      this.abortController = null;
    }
  }

  private trimHistory(): void {
    this.messages = trimMessages(this.messages);
  }

  async extractMemories(
    provider: LLMProvider,
    apiKey: string,
    model: string
  ): Promise<number> {
    if (!this.settings?.enableMemory || !this.settings?.autoExtractMemory) return 0;

    const conversation = this.messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    if (conversation.length < 100) return 0;

    const prompt = `Analyze this conversation and extract key facts about the user that would be useful to remember for future interactions.

Return a JSON array of objects. Each object has:
- "content": the fact (short, clear sentence)
- "category": one of "personal", "academic", "health", "family", "social", "other"
- "tags": array of relevant keywords

Only extract NEW, SPECIFIC facts. Do not repeat information already known. If no new facts, return [].

Conversation:
${conversation}

Return ONLY the JSON array, no explanation.`;

    try {
      const response = await callLLM(provider, apiKey, model, prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return 0;

      const facts = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(facts)) return 0;

      const manager = new MemoryManager(this.settings);
      let count = 0;

      for (const fact of facts) {
        if (!fact.content || typeof fact.content !== "string") continue;
        const content = fact.content.trim();
        if (content.length < 5) continue;

        const existing = manager.search(content, 3);
        const isDuplicate = existing.some((m) =>
          m.content.toLowerCase().includes(content.toLowerCase()) ||
          content.toLowerCase().includes(m.content.toLowerCase())
        );
        if (isDuplicate) continue;

        manager.add(
          content,
          fact.category || "other",
          Array.isArray(fact.tags) ? fact.tags.map(String) : []
        );
        count++;
      }

      return count;
    } catch {
      return 0;
    }
  }
}
