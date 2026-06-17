import { App } from "obsidian";
import {
  ChatMessage,
  StreamCallbacks,
  LLMProvider,
  ToolDefinition,
  ToolCall,
} from "./types";
import { streamChat } from "./llm-client";
import { executeTool, getToolDefinitions } from "./tool-registry";
import { trimMessages } from "./trim-messages";

function buildSystemPrompt(custom?: string): string {
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
- Respond in the same language the user uses.`;

  return `${base}\n\nToday's date is ${dateStr}. Use this as your temporal reference for any date-related questions, research, or context.`;
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

  constructor(app: App, systemPrompt?: string) {
    this.app = app;
    this.basePrompt = systemPrompt || "";
    this.systemPrompt = buildSystemPrompt(systemPrompt);
    this.messages = [{ role: "system", content: this.systemPrompt }];
  }

  reset(): void {
    this.systemPrompt = buildSystemPrompt(this.basePrompt || undefined);
    this.messages = [{ role: "system", content: this.systemPrompt }];
    this.abortController?.abort();
    this.abortController = null;
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

        for (const tc of pendingToolCalls) {
          const result = await executeTool(this.app, tc.name, tc.arguments);
          this.messages.push({
            role: "tool",
            content: result,
            toolCallId: tc.id,
          });

          this.viewCallbacks?.onToolResult({
            toolCallId: tc.id,
            content: result,
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
    this.messages = trimMessages(this.messages, 8);
  }
}
