import { App, MarkdownRenderer, Component } from "obsidian";
import { LLMProvider, LLM_MODELS, ChatMessage, StreamCallbacks } from "./types";
import { streamChat } from "./llm-client";
import { getToolDefinitions } from "./tool-registry";
import { stripMarkdown } from "./strip-markdown";

export class ModelComparison {
  private app: App;
  private container: HTMLElement;
  private panelEl: HTMLElement | null = null;
  private mdComponents: Component[] = [];

  constructor(app: App, container: HTMLElement) {
    this.app = app;
    this.container = container;
  }

  async compare(
    messages: ChatMessage[],
    provider: LLMProvider,
    apiKey: string,
    primaryModel: string,
    compareModel: string
  ): Promise<void> {
    this.close();
    this.panelEl = this.container.createDiv("neuro-vault-compare-panel");
    const header = this.panelEl.createDiv("neuro-vault-compare-header");
    header.createSpan({ text: `Comparing: ${primaryModel} vs ${compareModel}`, cls: "neuro-vault-compare-title" });
    const closeBtn = header.createEl("button", { text: "✕", cls: "neuro-vault-compare-close" });
    closeBtn.addEventListener("click", () => this.close());

    const body = this.panelEl.createDiv("neuro-vault-compare-body");
    const contentEl = body.createDiv("neuro-vault-compare-content");
    let rawContent = "";

    const abortController = new AbortController();
    const callbacks: StreamCallbacks = {
      onToken: (token) => {
        rawContent += token;
        contentEl.textContent = stripMarkdown(rawContent);
      },
      onToolCall: () => {},
      onToolResult: () => {},
      onDone: () => {
        if (rawContent) {
          contentEl.empty();
          const comp = new Component();
          comp.load();
          this.mdComponents.push(comp);
          MarkdownRenderer.render(this.app, rawContent, contentEl, "", comp);
        }
      },
      onError: (err) => {
        contentEl.textContent = `Error: ${err}`;
      },
    };

    const tools = getToolDefinitions();
    try {
      await streamChat(provider, apiKey, compareModel, messages, tools, callbacks, abortController.signal);
    } catch (e) {
      contentEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  close(): void {
    for (const c of this.mdComponents) c.unload();
    this.mdComponents = [];
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
  }
}
