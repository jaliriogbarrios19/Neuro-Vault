import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type NeuroVaultPlugin from "../main";
import { ChatEngine } from "./chat-engine";
import { ChatMessage, ChatSession, LLM_MODELS, MODEL_FIELDS } from "./types";
import { createMessageEl } from "./render-message";
import { createSidebar, updateIncognitoBtn, updateModeBtn } from "./sidebar";
import { createHistoryPanel, generateSessionId } from "./history-panel";
import { StreamHandler } from "./stream-handler";
import { FileAutocomplete } from "./file-autocomplete";
import { ConversationSearch } from "./conversation-search";
import { VoiceInput } from "./voice-input";
import { ModelComparison } from "./model-comparison";
import { showExportMenu, showCostBadge, branchConversation, showCompareMenu, showTemplatesMenu } from "./chat-actions";
import { migrateOldConversation, findActiveSession, saveCurrentSession, deleteSession } from "./session-manager";

export const VIEW_TYPE_CHAT = "neuro-vault-chat";

export class ChatView extends ItemView {
  private plugin: NeuroVaultPlugin;
  private engine: ChatEngine;
  private stream: StreamHandler;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private sidebarEl!: HTMLElement;
  private contentAreaEl!: HTMLElement;
  private fileAutocomplete!: FileAutocomplete;
  private conversationSearch!: ConversationSearch;
  private voiceInput!: VoiceInput;
  private modelComparison!: ModelComparison;
  private lastUserMessage: string | null = null;
  private activeSessionId: string | undefined;
  private incognito = false;
  private agentMode: "chat" | "agent" = "agent";
  private historyOpen = false;

  constructor(leaf: WorkspaceLeaf, plugin: NeuroVaultPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.engine = new ChatEngine(plugin.app, plugin.settings.systemPrompt || undefined);
    this.stream = new StreamHandler(plugin.app);
    this.engine.setViewCallbacks(this.stream.createCallbacks(
      () => this.scrollToBottom(),
      () => this.setInputEnabled(true),
      (msg) => { this.showError(msg); this.setInputEnabled(true); this.scrollToBottom(); },
    ));
  }

  getViewType(): string { return VIEW_TYPE_CHAT; }
  getDisplayText(): string { return "Neuro Vault Chat"; }
  getIcon(): string { return "bot"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("neuro-vault-chat");
    const theme = this.plugin.settings.chatTheme || "obsidian";
    if (theme !== "obsidian") container.addClass(`neuro-vault-theme-${theme}`);

    const header = container.createDiv("neuro-vault-chat-header");
    header.createEl("span", { text: "Neuro Vault", cls: "neuro-vault-chat-title" });
    const modelSelector = header.createEl("select", { cls: "neuro-vault-model-selector" });
    this.populateModelSelector(modelSelector);
    modelSelector.addEventListener("change", async () => {
      const provider = this.plugin.settings.llmProvider;
      const field = MODEL_FIELDS[provider];
      (this.plugin.settings as unknown as Record<string, string>)[field] = modelSelector.value;
      await this.plugin.saveSettings();
    });

    this.incognito = this.plugin.settings.flashMode || false;
    this.agentMode = this.plugin.settings.agentMode || "agent";
    const body = container.createDiv("neuro-vault-chat-body");
    this.sidebarEl = createSidebar(body, {
      onWebSearch: () => this.handleQuickSearch("web"),
      onAcademicSearch: () => this.handleQuickSearch("academic"),
      onNewChat: () => this.newChat(),
      onToggleIncognito: () => this.toggleIncognito(),
      onToggleMode: () => this.toggleMode(),
      onHistory: () => this.toggleHistory(),
      onExport: () => showExportMenu(this.plugin.app, this.engine.getMessages(), { x: 0, y: 0 }),
      onCompare: () => showCompareMenu(this.engine.getMessages(), this.plugin, this.modelComparison, () => this.scrollToBottom()),
      onTemplates: () => showTemplatesMenu(() => this.newChat(), this.inputEl),
    }, () => this.incognito, () => this.agentMode === "agent");

    this.contentAreaEl = body.createDiv("neuro-vault-content-area");
    this.messagesEl = this.contentAreaEl.createDiv("neuro-vault-messages");
    this.stream.setMessagesEl(this.messagesEl);
    this.conversationSearch = new ConversationSearch(this.contentAreaEl, this.messagesEl);
    this.modelComparison = new ModelComparison(this.plugin.app, this.contentAreaEl);
    this.migrateAndRestore();

    const inputArea = this.contentAreaEl.createDiv("neuro-vault-input-area");
    this.inputEl = inputArea.createEl("textarea", {
      attr: { placeholder: "Ask anything... (@file to reference, Enter to send)", rows: "1" },
    });
    this.fileAutocomplete = new FileAutocomplete(this.plugin.app, this.inputEl, () => {});
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.handleSend(); }
    });
    this.inputEl.addEventListener("input", () => {
      this.inputEl.setCssProps({ "--nv-h": "auto" });
      const h = Math.min(this.inputEl.scrollHeight, 120) + "px";
      this.inputEl.setCssProps({ "--nv-h": h });
    });
    this.sendBtn = inputArea.createEl("button", { text: "Send" });
    this.sendBtn.addEventListener("click", () => this.handleSend());
    const voiceBtn = inputArea.createEl("button", { text: "\u{1F3A4}", cls: "neuro-vault-voice-btn" });
    this.voiceInput = new VoiceInput();
    this.voiceInput.attach(voiceBtn, this.inputEl);

    this.containerEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape" && this.engine.isRunning()) { this.abort(); }
      if (e.ctrlKey && e.key === "n") { e.preventDefault(); this.newChat(); }
      if (e.ctrlKey && e.key === "l") { e.preventDefault(); this.newChat(); }
      if (e.ctrlKey && e.key === "h") { e.preventDefault(); this.toggleHistory(); }
      if (e.ctrlKey && e.shiftKey && e.key === "M") { e.preventDefault(); this.toggleMode(); }
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); this.conversationSearch.toggle(); }
    });
  }

  async onClose(): Promise<void> {
    this.engine.abort();
    this.stream.cleanup();
    this.fileAutocomplete.destroy();
    this.conversationSearch.close();
    this.voiceInput.destroy();
    this.modelComparison.close();
  }

  receiveExternalMessage(text: string): void {
    this.inputEl.value = text;
    this.handleSend();
  }

  getMessages(): ChatMessage[] {
    return this.engine.getMessages();
  }

  private renderEmptyState(): void {
    this.messagesEl.empty();
    const empty = this.messagesEl.createDiv("neuro-vault-empty");
    empty.createEl("p", { text: "Neuro Vault", cls: "neuro-vault-empty-title" });
    empty.createEl("p", {
      text: this.agentMode === "agent"
        ? "AI agent with access to your vault. I can read files, search notes, and more. What do you need?"
        : "Chat mode \u2014 ask me anything. I can search the web but won't modify your vault.",
    });
  }

  private renderConversation(messages: ChatMessage[]): void {
    this.messagesEl.empty();
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const onBranch = msg.role === "assistant"
        ? () => this.doBranch(messages.slice(0, i + 1))
        : undefined;
      this.stream.renderMessage(msg, onBranch);
    }
    this.scrollToBottom();
  }

  private async migrateAndRestore(): Promise<void> {
    const s = this.plugin.settings;
    if (migrateOldConversation(s)) await this.plugin.saveSettings();
    const active = findActiveSession(s);
    if (active?.messages.length) {
      this.activeSessionId = active.id;
      this.engine.restoreMessages(active.messages);
      this.renderConversation(active.messages);
      return;
    }
    this.renderEmptyState();
  }

  private newChat(): void {
    this.engine.abort();
    this.engine.reset();
    this.stream.cleanup();
    if (!this.incognito) this.doSave();
    this.activeSessionId = generateSessionId();
    this.renderEmptyState();
    this.setInputEnabled(true);
    if (this.historyOpen) this.toggleHistory();
  }

  private handleQuickSearch(type: "web" | "academic"): void {
    if (this.messagesEl.querySelector(".neuro-vault-empty")) this.messagesEl.empty();
    this.inputEl.value = type === "web" ? "Search the web for: " : "Research: ";
    this.inputEl.focus();
  }

  private async toggleIncognito(): Promise<void> {
    this.incognito = !this.incognito;
    this.plugin.settings.flashMode = this.incognito;
    await this.plugin.saveSettings();
    updateIncognitoBtn(this.sidebarEl, this.incognito);
    new Notice(this.incognito ? "Incognito ON \u2014 sessions won't be saved" : "Incognito OFF \u2014 sessions are saved", 3000);
  }

  private async toggleMode(): Promise<void> {
    this.agentMode = this.agentMode === "agent" ? "chat" : "agent";
    this.plugin.settings.agentMode = this.agentMode;
    await this.plugin.saveSettings();
    updateModeBtn(this.sidebarEl, this.agentMode === "agent");
    new Notice(this.agentMode === "agent" ? "Agent mode \u2014 full tool access" : "Chat mode \u2014 web search only", 3000);
    this.renderEmptyState();
  }

  private toggleHistory(): void {
    this.historyOpen = !this.historyOpen;
    if (this.historyOpen) {
      createHistoryPanel(this.contentAreaEl, this.plugin.settings.chatSessions || [], this.activeSessionId, {
        onRestore: (id) => this.restoreSession(id),
        onDelete: (id) => this.doDelete(id),
        onClose: () => this.toggleHistory(),
      });
      this.messagesEl.addClass("neuro-vault-messages-hidden");
    } else {
      this.contentAreaEl.querySelector(".neuro-vault-history-panel")?.remove();
      this.messagesEl.removeClass("neuro-vault-messages-hidden");
    }
  }

  private restoreSession(sessionId: string): void {
    const session = (this.plugin.settings.chatSessions || []).find((s) => s.id === sessionId);
    if (!session) return;
    this.engine.abort();
    this.stream.cleanup();
    this.activeSessionId = session.id;
    this.plugin.settings.activeSessionId = session.id;
    this.plugin.saveSettings();
    this.engine.restoreMessages(session.messages);
    this.renderConversation(session.messages);
    this.toggleHistory();
    this.setInputEnabled(true);
  }

  private doDelete(sessionId: string): void {
    const wasActive = deleteSession(this.plugin.settings, sessionId);
    if (wasActive) {
      this.activeSessionId = undefined;
      this.engine.reset();
      this.renderEmptyState();
    }
    this.plugin.saveSettings();
    if (this.historyOpen) {
      this.contentAreaEl.querySelector(".neuro-vault-history-panel")?.remove();
      createHistoryPanel(this.contentAreaEl, this.plugin.settings.chatSessions || [], this.activeSessionId, {
        onRestore: (id) => this.restoreSession(id),
        onDelete: (id) => this.doDelete(id),
        onClose: () => this.toggleHistory(),
      });
    }
  }

  private doBranch(messages: ChatMessage[]): void {
    branchConversation(messages, () => this.doSave(), this.incognito, this.engine, this.stream,
      (msgs) => this.renderConversation(msgs), (v) => this.setInputEnabled(v),
      (id) => { this.activeSessionId = id; });
  }

  private doSave(): void {
    const msgs = this.engine.getMessages();
    if (msgs.length) {
      this.activeSessionId = saveCurrentSession(this.plugin.settings, msgs, this.activeSessionId);
      this.plugin.saveSettings();
    }
  }

  private showError(message: string): void {
    const errEl = document.createElement("div");
    errEl.className = "neuro-vault-error";
    errEl.createSpan({ text: `Error: ${message}` });
    if (this.lastUserMessage) {
      const btn = errEl.createEl("button", { text: "Retry", cls: "neuro-vault-retry-btn" });
      btn.addEventListener("click", () => { errEl.remove(); this.retry(); });
    }
    this.messagesEl.appendChild(errEl);
  }

  private async retry(): Promise<void> {
    if (!this.lastUserMessage) return;
    const s = this.plugin.settings;
    this.setInputEnabled(false);
    this.stream.showLoading();
    try {
      await this.engine.retry(s.llmProvider, this.plugin.getApiKey(s.llmProvider), this.plugin.getModel(s.llmProvider), this.agentMode);
    } catch { this.stream.hideLoading(); }
    finally { if (!this.engine.isRunning()) this.doSave(); }
  }

  private async handleSend(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text) return;
    const settings = this.plugin.settings;
    const provider = settings.llmProvider;
    const apiKey = this.plugin.getApiKey(provider);
    if (!apiKey) { this.showError("No API key configured. Go to Settings \u2192 Neuro Vault."); return; }
    if (this.messagesEl.querySelector(".neuro-vault-empty")) this.messagesEl.empty();
    this.messagesEl.appendChild(createMessageEl({ role: "user", content: text }));
    this.scrollToBottom();
    this.inputEl.value = "";
    this.inputEl.setCssProps({ "--nv-h": "auto" });
    this.setInputEnabled(false);
    this.stream.showLoading();
    this.lastUserMessage = text;
    const model = this.plugin.getModel(provider);
    try {
      await this.engine.send(text, provider, apiKey, model, this.agentMode);
    } catch (e) {
      this.showError(e instanceof Error ? e.message : String(e));
      this.setInputEnabled(true);
      this.stream.hideLoading();
    } finally {
      if (!this.engine.isRunning()) {
        this.setInputEnabled(true);
        showCostBadge(this.messagesEl, this.engine.getMessages(), text, model, () => this.scrollToBottom());
        this.doSave();
      }
    }
  }

  private abort(): void {
    this.engine.abort();
    this.setInputEnabled(true);
  }

  private setInputEnabled(enabled: boolean): void {
    this.inputEl.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
    if (this.engine.isRunning()) {
      this.sendBtn.setText("Stop");
      this.sendBtn.addClass("neuro-vault-stop-btn");
      this.sendBtn.onclick = () => this.abort();
    } else {
      this.sendBtn.setText("Send");
      this.sendBtn.removeClass("neuro-vault-stop-btn");
      this.sendBtn.onclick = () => this.handleSend();
    }
  }

  private scrollToBottom(): void {
    const el = this.messagesEl;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50)
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  private populateModelSelector(select: HTMLSelectElement): void {
    const provider = this.plugin.settings.llmProvider;
    const models = LLM_MODELS[provider] || [];
    const current = this.plugin.getModel(provider);
    select.empty();
    for (const m of models) {
      const opt = select.createEl("option", { value: m.modelId, text: m.label });
      if (m.modelId === current) opt.selected = true;
    }
  }
}
