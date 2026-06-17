import { MarkdownRenderer, Component } from "obsidian";
import { StreamCallbacks, ToolResult, ChatMessage } from "./types";
import { createMessageEl } from "./render-message";
import { stripMarkdown } from "./strip-markdown";

const MD_DEBOUNCE_MS = 500;

export class StreamHandler {
  private currentAssistantEl: HTMLElement | null = null;
  private assistantRawContent = "";
  private loadingEl: HTMLElement | null = null;
  private loadingDots = 0;
  private loadingInterval: number | null = null;
  private mdComponents: Component[] = [];
  private messagesEl!: HTMLElement;
  private app: import("obsidian").App;
  private mdDebounce: number | null = null;
  private streamingMdComp: Component | null = null;
  private pendingToolEls: Map<string, HTMLElement> = new Map();

  constructor(app: import("obsidian").App) {
    this.app = app;
  }

  setMessagesEl(el: HTMLElement): void {
    this.messagesEl = el;
  }

  cleanup(): void {
    this.clearMdDebounce();
    for (const c of this.mdComponents) c.unload();
    this.mdComponents = [];
    this.streamingMdComp = null;
    this.pendingToolEls.clear();
  }

  private clearMdDebounce(): void {
    if (this.mdDebounce) {
      window.clearTimeout(this.mdDebounce);
      this.mdDebounce = null;
    }
  }

  showLoading(): void {
    if (this.loadingEl) return;
    this.loadingEl = this.messagesEl.createDiv("neuro-vault-loading");
    const toggle = this.loadingEl.createSpan({ cls: "neuro-vault-loading-toggle" });
    toggle.setText("+");
    const label = this.loadingEl.createSpan({ text: "Thinking", cls: "neuro-vault-loading-label" });
    const dotsEl = this.loadingEl.createSpan({ cls: "neuro-vault-loading-dots nv-hidden" });
    this.loadingDots = 0;
    let expanded = false;
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      toggle.setText(expanded ? "-" : "+");
      toggle.toggleClass("neuro-vault-loading-toggle-expanded", expanded);
      dotsEl.toggleClass("nv-hidden", !expanded);
      if (expanded) {
        this.loadingInterval = window.setInterval(() => {
          this.loadingDots = (this.loadingDots + 1) % 4;
          dotsEl.setText(".".repeat(this.loadingDots));
        }, 400);
      } else {
        if (this.loadingInterval) window.clearInterval(this.loadingInterval);
        this.loadingInterval = null;
        dotsEl.setText("");
      }
    });
  }

  hideLoading(): void {
    if (this.loadingInterval) window.clearInterval(this.loadingInterval);
    this.loadingInterval = null;
    if (this.loadingEl) this.loadingEl.remove();
    this.loadingEl = null;
  }

  renderMessage(msg: ChatMessage, onBranch?: () => void): HTMLElement {
    const el = createMessageEl(msg, undefined, onBranch);
    this.messagesEl.appendChild(el);
    if (msg.role === "assistant" && msg.content) this.renderMarkdownAsync(el, msg.content);
    return el;
  }

  private async renderMarkdownAsync(el: HTMLElement, content: string): Promise<void> {
    const contentEl = el.querySelector(".neuro-vault-message-content") as HTMLElement | null;
    if (!contentEl) return;
    contentEl.empty();
    const comp = new Component();
    comp.load();
    this.mdComponents.push(comp);
    await MarkdownRenderer.render(this.app, content, contentEl, "", comp);
  }

  private scheduleStreamingMdRender(): void {
    this.clearMdDebounce();
    this.mdDebounce = window.setTimeout(() => {
      this.mdDebounce = null;
      if (!this.currentAssistantEl || !this.assistantRawContent) return;
      const contentEl = this.currentAssistantEl.querySelector(".neuro-vault-message-content") as HTMLElement | null;
      if (!contentEl) return;
      if (this.streamingMdComp) {
        this.streamingMdComp.unload();
        this.streamingMdComp = null;
      }
      const comp = new Component();
      comp.load();
      this.streamingMdComp = comp;
      contentEl.empty();
      MarkdownRenderer.render(this.app, this.assistantRawContent, contentEl, "", comp).then(() => {
        this.streamingMdComp = comp;
      });
    }, MD_DEBOUNCE_MS);
  }

  createCallbacks(scrollCb: () => void, doneCb: () => void, errorCb: (msg: string) => void): StreamCallbacks {
    return {
      onToken: (token) => {
        this.hideLoading();
        if (!this.currentAssistantEl) {
          this.currentAssistantEl = createMessageEl({ role: "assistant", content: "" });
          this.messagesEl.appendChild(this.currentAssistantEl);
          this.assistantRawContent = "";
        }
        const content = this.currentAssistantEl.querySelector(".neuro-vault-message-content");
        if (content) {
          this.assistantRawContent += token;
          content.textContent = stripMarkdown(this.assistantRawContent);
        }
        this.scheduleStreamingMdRender();
        scrollCb();
      },
      onToolCall: (name, _args, id) => {
        this.hideLoading();
        this.clearMdDebounce();
        const tcEl = document.createElement("div");
        tcEl.className = "neuro-vault-tool-badge";
        const icon = tcEl.createSpan({ cls: "neuro-vault-tool-badge-icon", text: "⚙" });
        const label = tcEl.createSpan({ cls: "neuro-vault-tool-badge-name", text: name });
        const status = tcEl.createSpan({ cls: "neuro-vault-tool-badge-status", text: "…" });
        const tooltip = tcEl.createDiv({ cls: "neuro-vault-tool-badge-tooltip nv-hidden" });
        tcEl.addEventListener("mouseenter", () => { tooltip.removeClass("nv-hidden"); });
        tcEl.addEventListener("mouseleave", () => { tooltip.addClass("nv-hidden"); });
        if (this.currentAssistantEl) {
          this.currentAssistantEl.appendChild(tcEl);
        } else {
          this.messagesEl.appendChild(tcEl);
        }
        if (id) this.pendingToolEls.set(id, tcEl);
        scrollCb();
      },
      onToolResult: (result: ToolResult) => {
        const tcEl = this.pendingToolEls.get(result.toolCallId);
        if (tcEl) {
          const status = tcEl.querySelector(".neuro-vault-tool-badge-status");
          if (status) status.textContent = "✓";
          tcEl.addClass("neuro-vault-tool-badge-success");
          const tooltip = tcEl.querySelector(".neuro-vault-tool-badge-tooltip") as HTMLElement | null;
          if (tooltip) {
            const truncated = result.content.length > 300;
            tooltip.textContent = truncated ? result.content.slice(0, 300) + "…" : result.content;
          }
          this.pendingToolEls.delete(result.toolCallId);
        }
        this.showLoading();
      },
      onDone: () => {
        this.hideLoading();
        this.clearMdDebounce();
        if (this.streamingMdComp) {
          this.streamingMdComp.unload();
          this.streamingMdComp = null;
        }
        if (this.currentAssistantEl && this.assistantRawContent) {
          this.renderMarkdownAsync(this.currentAssistantEl, this.assistantRawContent);
        }
        this.currentAssistantEl = null;
        this.assistantRawContent = "";
        doneCb();
      },
      onError: (error) => {
        this.hideLoading();
        this.clearMdDebounce();
        if (this.streamingMdComp) {
          this.streamingMdComp.unload();
          this.streamingMdComp = null;
        }
        this.currentAssistantEl = null;
        this.assistantRawContent = "";
        errorCb(error);
      },
    };
  }
}
