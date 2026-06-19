import { Plugin, Editor, MarkdownView } from "obsidian";
import {
  DEFAULT_SETTINGS,
  SettingsTab,
  setSpobBaseUrl,
  setPluginInstance,
} from "./src/settings";
import { ChatView, VIEW_TYPE_CHAT } from "./src/chat-view";
import { DictateModal } from "./src/dictate-modal";
import "./src/tools/echo";
import "./src/tools/vault-ops";
import "./src/tools/web-search";
import "./src/tools/academic-search";
import "./src/tools/audio-transcribe";
import "./src/tools/pdf-read";
import "./src/tools/memory-tools";
import { LLMProvider, LLM_MODELS, API_KEY_FIELDS, MODEL_FIELDS, DEFAULT_MODELS, PluginSettings, ChatMessage } from "./src/types";

export default class NeuroVaultPlugin extends Plugin {
  settings!: PluginSettings;

  async onload() {
    await this.loadSettings();
    setPluginInstance(this);

    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerView(
      VIEW_TYPE_CHAT,
      (leaf) => new ChatView(leaf, this)
    );

    this.addRibbonIcon("bot", "Neuro Vault Chat", () => {
      this.activateChat();
    });

    this.addCommand({
      id: "open-neuro-vault-chat",
      name: "Open Neuro Vault Chat",
      callback: () => this.activateChat(),
    });

    this.addCommand({
      id: "dictate-to-note",
      name: "Dictate to note",
      editorCallback: (editor: Editor) => {
        new DictateModal(this.app, this, editor).open();
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        menu.addItem((item) => {
          item
            .setTitle("Dictate with Neuro Vault")
            .setIcon("mic")
            .onClick(() => {
              new DictateModal(this.app, this, editor).open();
            });
        });
      })
    );
  }

  onunload() {
    setPluginInstance(null);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setSpobBaseUrl(this.settings.spobBaseUrl || DEFAULT_SETTINGS.spobBaseUrl);

    if (this.settings.openrouterCustomModels?.length) {
      LLM_MODELS.openrouter = this.settings.openrouterCustomModels;
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
    setSpobBaseUrl(this.settings.spobBaseUrl || DEFAULT_SETTINGS.spobBaseUrl);
  }

  getApiKey(provider: LLMProvider): string {
    const field = API_KEY_FIELDS[provider];
    return (this.settings as unknown as Record<string, string>)[field] ?? "";
  }

  getModel(provider: LLMProvider): string {
    const field = MODEL_FIELDS[provider];
    const model = (this.settings as unknown as Record<string, string>)[field];
    return model || DEFAULT_MODELS[provider];
  }

  getActiveChatView(): ChatView | null {
    const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
    if (!leaf?.view || !(leaf.view instanceof ChatView)) return null;
    return leaf.view;
  }

  async sendMessage(text: string): Promise<void> {
    const view = this.getActiveChatView();
    if (!view) {
      await this.activateChat();
      window.setTimeout(() => {
        const v = this.getActiveChatView();
        if (v) v.receiveExternalMessage(text);
      }, 300);
    } else {
      view.receiveExternalMessage(text);
    }
  }

  getConversation(): ChatMessage[] {
    const view = this.getActiveChatView();
    return view ? view.getMessages() : [];
  }

  private async activateChat() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_CHAT)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeaf(true);
      if (newLeaf) {
        await newLeaf.setViewState({
          type: VIEW_TYPE_CHAT,
          active: true,
        });
        leaf = newLeaf;
      }
    }
    if (leaf) workspace.revealLeaf(leaf);
  }
}
