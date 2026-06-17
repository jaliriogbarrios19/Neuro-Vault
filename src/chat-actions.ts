import { Notice, Menu } from "obsidian";
import type NeuroVaultPlugin from "../main";
import { ChatMessage, ChatSession, LLM_MODELS } from "./types";
import { estimateCost, formatCost } from "./cost-estimator";
import { generateSessionId, getSessionTitle } from "./history-panel";
import { exportConversationToVault, type ExportFormat, type ExportScope } from "./export-conversation";
import { ModelComparison } from "./model-comparison";

export function showExportMenu(
  app: import("obsidian").App,
  messages: ChatMessage[],
  anchor: { x: number; y: number }
): void {
  const menu = new Menu();
  menu.addItem((item) => item.setTitle("Full conversation (Markdown)").onClick(async () => {
    const path = await exportConversationToVault(app, messages, "markdown", "full");
    new Notice(`Exported to ${path}`);
  }));
  menu.addItem((item) => item.setTitle("Full conversation (HTML)").onClick(async () => {
    const path = await exportConversationToVault(app, messages, "html", "full");
    new Notice(`Exported to ${path}`);
  }));
  menu.addItem((item) => item.setTitle("Assistant only (Markdown)").onClick(async () => {
    const path = await exportConversationToVault(app, messages, "markdown", "assistant");
    new Notice(`Exported to ${path}`);
  }));
  menu.addItem((item) => item.setTitle("Assistant only (HTML)").onClick(async () => {
    const path = await exportConversationToVault(app, messages, "html", "assistant");
    new Notice(`Exported to ${path}`);
  }));
  menu.showAtPosition(anchor);
}

export function showCostBadge(
  messagesEl: HTMLElement,
  messages: ChatMessage[],
  inputText: string,
  modelId: string,
  scrollToBottom: () => void
): void {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return;
  const estimate = estimateCost(modelId, inputText, lastAssistant.content);
  const badge = document.createElement("div");
  badge.className = "neuro-vault-cost-badge";
  badge.textContent = formatCost(estimate);
  messagesEl.appendChild(badge);
  scrollToBottom();
}

export function branchConversation(
  messages: ChatMessage[],
  saveSession: () => void,
  incognito: boolean,
  engine: { abort: () => void; reset: () => void; restoreMessages: (msgs: ChatMessage[]) => void },
  stream: { cleanup: () => void },
  renderConversation: (msgs: ChatMessage[]) => void,
  setInputEnabled: (v: boolean) => void,
  setSessionId: (id: string) => void
): void {
  engine.abort();
  stream.cleanup();
  if (!incognito) saveSession();
  const newId = generateSessionId();
  setSessionId(newId);
  engine.reset();
  engine.restoreMessages(messages);
  renderConversation(messages);
  setInputEnabled(true);
  new Notice("Branched conversation \u2014 continue from here", 3000);
}

export function showCompareMenu(
  messages: ChatMessage[],
  plugin: NeuroVaultPlugin,
  comparison: ModelComparison,
  scrollToBottom: () => void
): void {
  if (!messages.length) { new Notice("Send a message first to compare models"); return; }
  const provider = plugin.settings.llmProvider;
  const models = LLM_MODELS[provider] || [];
  const currentModel = plugin.getModel(provider);
  const menu = new Menu();
  for (const m of models) {
    if (m.modelId === currentModel) continue;
      menu.addItem((item) => item.setTitle(m.label).onClick(async () => {
      const apiKey = plugin.getApiKey(provider);
      if (!apiKey) { new Notice("No API key configured"); return; }
      await comparison.compare(messages, provider, apiKey, currentModel, m.modelId);
    }));
  }
  menu.showAtPosition({ x: 0, y: 0 });
}

export function showTemplatesMenu(
  newChat: () => void,
  inputEl: HTMLTextAreaElement
): void {
  const templates = [
    { name: "Research Paper Analysis", prompt: "Analyze this research paper. Summarize the key findings, methodology, strengths, weaknesses, and implications. Cite specific sections when relevant." },
    { name: "Code Review", prompt: "Review this code for bugs, performance issues, and best practices. Suggest specific improvements with code examples." },
    { name: "Writing Assistant", prompt: "Help me improve this writing. Focus on clarity, flow, grammar, and style. Suggest specific rewrites where appropriate." },
    { name: "Brainstorm", prompt: "Help me brainstorm ideas on this topic. Generate diverse, creative suggestions. Group related ideas together and evaluate feasibility." },
    { name: "Summarize Notes", prompt: "Summarize the key points from my notes. Create a structured outline with main ideas and supporting details. Highlight connections between concepts." },
  ];
  const menu = new Menu();
  for (const t of templates) {
    menu.addItem((item) => item.setTitle(t.name).onClick(() => {
      newChat();
      inputEl.value = t.prompt;
      inputEl.focus();
    }));
  }
  menu.showAtPosition({ x: 0, y: 0 });
}
