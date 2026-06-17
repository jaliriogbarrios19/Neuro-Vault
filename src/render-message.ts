import type { ChatMessage, ToolCall } from "./types";

export function createMessageEl(
  msg: ChatMessage,
  toolCalls?: ToolCall[],
  onBranch?: () => void
): HTMLElement {
  const wrapper = createDiv("neuro-vault-message");

  if (msg.role === "user") {
    wrapper.addClass("neuro-vault-message-user");
    wrapper.createDiv({ text: msg.content });
    return wrapper;
  }

  if (msg.role === "assistant") {
    wrapper.addClass("neuro-vault-message-assistant");
    const content = wrapper.createDiv({
      cls: "neuro-vault-message-content",
    });
    content.setText(msg.content || "");

    const copyBtn = wrapper.createEl("button", {
      text: "Copy",
      cls: "neuro-vault-copy-btn",
    });
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(content.textContent ?? "");
      copyBtn.setText("Copied!");
      window.setTimeout(() => copyBtn.setText("Copy"), 2000);
    });

    if (onBranch) {
      const branchBtn = wrapper.createEl("button", {
        text: "Branch",
        cls: "neuro-vault-copy-btn neuro-vault-branch-btn",
      });
      branchBtn.addEventListener("click", onBranch);
    }

    if (toolCalls && toolCalls.length > 0) {
      for (const tc of toolCalls) {
        const tcEl = wrapper.createDiv({ cls: "neuro-vault-tool-badge neuro-vault-tool-badge-success" });
        tcEl.createSpan({ cls: "neuro-vault-tool-badge-icon", text: "⚙" });
        tcEl.createSpan({ cls: "neuro-vault-tool-badge-name", text: tc.name });
        tcEl.createSpan({ cls: "neuro-vault-tool-badge-status", text: "✓" });
        const tooltip = tcEl.createDiv({ cls: "neuro-vault-tool-badge-tooltip nv-hidden" });
        tooltip.textContent = JSON.stringify(tc.arguments, null, 2).slice(0, 300);
        tcEl.addEventListener("mouseenter", () => { tooltip.removeClass("nv-hidden"); });
        tcEl.addEventListener("mouseleave", () => { tooltip.addClass("nv-hidden"); });
      }
    }

    return wrapper;
  }

  if (msg.role === "tool") {
    return createToolResultEl(msg.content);
  }

  return wrapper;
}

export function createToolResultEl(content: string): HTMLElement {
  const trEl = createDiv("neuro-vault-message neuro-vault-message-tool");
  const header = trEl.createDiv({ cls: "neuro-vault-tool-header" });
  header.setText("Tool result");
  const body = trEl.createDiv({ cls: "neuro-vault-tool-content" });
  const truncated = content.length > 300;
  body.setText(truncated ? content.slice(0, 300) + "..." : content);
  if (truncated) {
    const toggle = trEl.createDiv({ cls: "neuro-vault-tool-toggle" });
    toggle.setText("Show full result");
    let expanded = false;
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      body.setText(expanded ? content : content.slice(0, 300) + "...");
      toggle.setText(expanded ? "Collapse" : "Show full result");
    });
  }
  return trEl;
}

function createDiv(cls: string): HTMLElement {
  const el = document.createElement("div");
  el.className = cls;
  return el;
}
