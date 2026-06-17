import { setIcon } from "obsidian";

export interface SidebarActions {
  onWebSearch: () => void;
  onAcademicSearch: () => void;
  onNewChat: () => void;
  onToggleIncognito: () => void;
  onToggleMode: () => void;
  onHistory: () => void;
  onExport: () => void;
  onCompare: () => void;
  onTemplates: () => void;
}

export function createSidebar(
  container: HTMLElement,
  actions: SidebarActions,
  isIncognito: () => boolean,
  isAgent: () => boolean
): HTMLElement {
  const sidebar = container.createDiv("neuro-vault-sidebar");

  const buttons: { icon: string; label: string; action: () => void; id: string }[] = [
    { icon: "search", label: "Web Search", action: actions.onWebSearch, id: "web" },
    { icon: "book-open", label: "Academic", action: actions.onAcademicSearch, id: "academic" },
    { icon: isAgent() ? "bot" : "message-circle", label: isAgent() ? "Agent Mode" : "Chat Mode", action: actions.onToggleMode, id: "mode" },
    { icon: "plus", label: "New Chat", action: actions.onNewChat, id: "new-chat" },
    { icon: "eye-off", label: "Incognito", action: actions.onToggleIncognito, id: "incognito" },
    { icon: "history", label: "History", action: actions.onHistory, id: "history" },
    { icon: "download", label: "Export", action: actions.onExport, id: "export" },
    { icon: "columns", label: "Compare Models", action: actions.onCompare, id: "compare" },
    { icon: "file-text", label: "Templates", action: actions.onTemplates, id: "templates" },
  ];

  for (const btn of buttons) {
    const el = sidebar.createDiv("neuro-vault-sidebar-btn");
    el.setAttribute("aria-label", btn.label);
    const iconEl = el.createDiv("neuro-vault-sidebar-icon");
    setIcon(iconEl, btn.icon);
    el.addEventListener("click", btn.action);
    if (btn.id === "incognito") {
      el.addClass("neuro-vault-incognito-btn");
      if (isIncognito()) el.addClass("neuro-vault-incognito-active");
    }
    if (btn.id === "mode") {
      el.addClass("neuro-vault-mode-btn");
      if (isAgent()) el.addClass("neuro-vault-mode-agent");
    }
  }

  return sidebar;
}

export function updateIncognitoBtn(sidebar: HTMLElement, active: boolean): void {
  const btn = sidebar.querySelector(".neuro-vault-incognito-btn");
  if (!btn) return;
  if (active) btn.addClass("neuro-vault-incognito-active");
  else btn.removeClass("neuro-vault-incognito-active");
}

export function updateModeBtn(sidebar: HTMLElement, isAgent: boolean): void {
  const btn = sidebar.querySelector(".neuro-vault-mode-btn");
  if (!btn) return;
  const iconEl = btn.querySelector(".neuro-vault-sidebar-icon");
  if (iconEl) {
    iconEl.empty();
    setIcon(iconEl as HTMLElement, isAgent ? "bot" : "message-circle");
  }
  btn.setAttribute("aria-label", isAgent ? "Agent Mode" : "Chat Mode");
  if (isAgent) btn.addClass("neuro-vault-mode-agent");
  else btn.removeClass("neuro-vault-mode-agent");
}
