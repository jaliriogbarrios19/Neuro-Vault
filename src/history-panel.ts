import type { ChatSession } from "./types";
import { setIcon } from "obsidian";

export interface HistoryPanelActions {
  onRestore: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onClose: () => void;
}

export function createHistoryPanel(
  container: HTMLElement,
  sessions: ChatSession[],
  activeSessionId: string | undefined,
  actions: HistoryPanelActions
): HTMLElement {
  const panel = container.createDiv("neuro-vault-history-panel");

  const header = panel.createDiv("neuro-vault-history-header");
  header.createEl("span", { text: "Chat History", cls: "neuro-vault-history-title" });
  const closeBtn = header.createDiv("neuro-vault-history-close");
  setIcon(closeBtn, "x");
  closeBtn.addEventListener("click", actions.onClose);

  const list = panel.createDiv("neuro-vault-history-list");

  if (sessions.length === 0) {
    list.createDiv({ text: "No saved sessions", cls: "neuro-vault-history-empty" });
    return panel;
  }

  const sorted = [...sessions].sort((a, b) => b.createdAt - a.createdAt);

  for (const session of sorted) {
    const item = list.createDiv("neuro-vault-history-item");
    if (session.id === activeSessionId) item.addClass("neuro-vault-history-item-active");

    const info = item.createDiv("neuro-vault-history-item-info");
    info.createEl("div", { text: session.title, cls: "neuro-vault-history-item-title" });
    const date = new Date(session.createdAt);
    info.createEl("div", {
      text: date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      cls: "neuro-vault-history-item-date",
    });

    const deleteBtn = item.createDiv("neuro-vault-history-item-delete");
    setIcon(deleteBtn, "trash-2");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      actions.onDelete(session.id);
    });

    item.addEventListener("click", () => actions.onRestore(session.id));
  }

  return panel;
}

export function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getSessionTitle(messages: { role: string; content: string }[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Untitled Chat";
  return firstUser.content.slice(0, 50).replace(/\n/g, " ").trim() || "Untitled Chat";
}
