import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type NeuroVaultPlugin from "../main";
import {
  LLMProvider,
  LLM_PROVIDERS,
  LLM_MODELS,
  PluginSettings,
  API_KEY_FIELDS,
  MODEL_FIELDS,
  DEFAULT_MODELS,
} from "./types";

let spobBaseUrl = "https://spob-backend.fly.dev";
let pluginInstance: NeuroVaultPlugin | null = null;

export function getSpobBaseUrl(): string {
  return spobBaseUrl;
}

export function setSpobBaseUrl(url: string): void {
  spobBaseUrl = url;
}

export function setPluginInstance(plugin: NeuroVaultPlugin | null): void {
  pluginInstance = plugin;
}

export function getPluginInstance(): NeuroVaultPlugin | null {
  return pluginInstance;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  llmProvider: "spob",
  openaiApiKey: "",
  openaiModel: "gpt-5.5",
  anthropicApiKey: "",
  anthropicModel: "claude-opus-4-8-20260514",
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-pro",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash",
  openrouterApiKey: "",
  openrouterModel: "openai/gpt-5.5",
  grokApiKey: "",
  grokModel: "grok-4.3",
  glmApiKey: "",
  glmModel: "glm-5",
  spobApiKey: "",
  spobModel: "deepseek-v4-pro",
  spobBaseUrl: "https://spob-backend.fly.dev",
  braveApiKey: "",
  tavilyApiKey: "",
  searxngUrl: "",
  webSearchProvider: "brave",
  pubmedApiKey: "",
  crossrefEmail: "",
  systemPrompt: "",
  chatTheme: "obsidian",
};

export class SettingsTab extends PluginSettingTab {
  plugin: NeuroVaultPlugin;
  private saveTimeout: number | null = null;

  constructor(app: App, plugin: NeuroVaultPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide(): void {
    if (this.saveTimeout) {
      window.clearTimeout(this.saveTimeout);
      this.plugin.saveSettings();
      this.saveTimeout = null;
    }
  }

  private debouncedSave(): void {
    if (this.saveTimeout) window.clearTimeout(this.saveTimeout);
    this.saveTimeout = window.setTimeout(() => {
      this.plugin.saveSettings();
      this.saveTimeout = null;
    }, 500);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Neuro Vault").setHeading();
    containerEl.createEl("p", {
      text: "AI agent chat with tools, web search, and audio.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("LLM Provider")
      .setDesc("AI provider for chat and tool execution")
      .addDropdown((dropdown) => {
        for (const { value, label } of LLM_PROVIDERS) {
          dropdown.addOption(value, label);
        }
        dropdown
          .setValue(this.plugin.settings.llmProvider)
          .onChange(async (v: string) => {
            this.plugin.settings.llmProvider = v as LLMProvider;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const provider = this.plugin.settings.llmProvider;

    this.addApiKeyField(containerEl, provider);

    const models = LLM_MODELS[provider];
    if (models && models.length > 0) {
      const modelField = MODEL_FIELDS[provider];
      new Setting(containerEl)
        .setName("Model")
        .setDesc("AI model for chat")
        .addDropdown((dropdown) => {
          for (const m of models) {
            dropdown.addOption(m.modelId, `${m.label} — ${m.description}`);
          }
          const current =
            String(
              (this.plugin.settings as unknown as Record<string, string>)[
                modelField
              ]
            ) || DEFAULT_MODELS[provider];
          dropdown
            .setValue(current)
            .onChange((v: string) => {
              (
                this.plugin.settings as unknown as Record<string, string>
              )[modelField] = v;
              this.debouncedSave();
            });
        });
    }

    if (provider === "spob") {
      new Setting(containerEl)
        .setName("spob Backend URL")
        .setDesc("spob server URL (default: localhost:8080)")
        .addText((text) => {
          text
            .setPlaceholder("http://localhost:8080")
            .setValue(this.plugin.settings.spobBaseUrl)
            .onChange((value) => {
              this.plugin.settings.spobBaseUrl = value;
              this.debouncedSave();
            });
        });
    }

    new Setting(containerEl).setName("Web Search").setHeading();

    new Setting(containerEl)
      .setName("Web Search Provider")
      .setDesc("API used for web_search tool")
      .addDropdown((dropdown) => {
        dropdown.addOption("brave", "Brave Search");
        dropdown.addOption("tavily", "Tavily");
        dropdown.addOption("searxng", "SearXNG");
        dropdown
          .setValue(this.plugin.settings.webSearchProvider)
          .onChange(async (v) => {
            this.plugin.settings.webSearchProvider = v as "brave" | "tavily" | "searxng";
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const wsp = this.plugin.settings.webSearchProvider;

    if (wsp === "brave") {
      new Setting(containerEl)
        .setName("Brave Search API Key")
        .setDesc("Free: https://brave.com/search/api/")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.braveApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.braveApiKey = value;
            this.debouncedSave();
          });
        });
    }

    if (wsp === "tavily") {
      new Setting(containerEl)
        .setName("Tavily API Key")
        .setDesc("Free: https://tavily.com (1000 searches/month)")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.tavilyApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.tavilyApiKey = value;
            this.debouncedSave();
          });
        });
    }

    if (wsp === "searxng") {
      new Setting(containerEl)
        .setName("SearXNG Instance URL")
        .setDesc("Self-hosted: docker run -d -p 8080:8080 searxng/searxng")
        .addText((text) => {
          text.setPlaceholder("http://localhost:8080").setValue(this.plugin.settings.searxngUrl);
          text.onChange((value) => {
            this.plugin.settings.searxngUrl = value;
            this.debouncedSave();
          });
        });
    }

    new Setting(containerEl).setName("Tool API Keys").setHeading();

    new Setting(containerEl)
      .setName("PubMed API Key")
      .setDesc("Optional. Get from NCBI. Increases rate limit.")
      .addText((text) => {
        text
          .setPlaceholder("Enter API key (optional)")
          .setValue(this.plugin.settings.pubmedApiKey)
          .onChange((value) => {
            this.plugin.settings.pubmedApiKey = value;
            this.debouncedSave();
          });
        text.inputEl.type = "password";
        this.addToggleBtn(text);
      });

    new Setting(containerEl)
      .setName("OpenAlex Email")
      .setDesc("For polite API access to OpenAlex")
      .addText((text) => {
        text
          .setPlaceholder("your@email.com")
          .setValue(this.plugin.settings.crossrefEmail)
          .onChange((value) => {
            this.plugin.settings.crossrefEmail = value;
            this.debouncedSave();
          });
      });

    new Setting(containerEl).setName("System Prompt").setHeading();

    new Setting(containerEl)
      .setName("Custom System Prompt")
      .setDesc("Leave empty to use the default. Changes apply on New Chat.")
      .addTextArea((text) => {
        text
          .setPlaceholder("Default: You are Neuro Vault, an AI agent inside Obsidian...")
          .setValue(this.plugin.settings.systemPrompt)
          .onChange((value) => {
            this.plugin.settings.systemPrompt = value;
            this.debouncedSave();
          });
        text.inputEl.rows = 4;
      });

    new Setting(containerEl)
      .setName("Chat Theme")
      .setDesc("Visual theme for the chat panel")
      .addDropdown((dropdown) => {
        dropdown.addOption("obsidian", "Match Obsidian");
        dropdown.addOption("dark", "Custom Dark");
        dropdown.addOption("light", "Custom Light");
        dropdown
          .setValue(this.plugin.settings.chatTheme || "obsidian")
          .onChange(async (v) => {
            this.plugin.settings.chatTheme = v as "obsidian" | "dark" | "light";
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl).setName("All LLM API Keys").setHeading();

    for (const { value, label } of LLM_PROVIDERS) {
      const field = API_KEY_FIELDS[value];
      new Setting(containerEl).setName(label).addText((text) => {
        text
          .setPlaceholder("Enter API key")
          .setValue(
            String(
              (this.plugin.settings as unknown as Record<string, string>)[
                field
              ] ?? ""
            )
          );
        text.inputEl.type = "password";

        const toggleBtn = text.inputEl.parentElement?.createEl("button", {
          text: "Show",
          cls: "neuro-vault-toggle-key",
        });
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            const isPassword = text.inputEl.type === "password";
            text.inputEl.type = isPassword ? "text" : "password";
            toggleBtn.textContent = isPassword ? "Hide" : "Show";
          };
        }

        text.onChange((value) => {
          (
            this.plugin.settings as unknown as Record<string, string>
          )[field] = value;
          this.debouncedSave();
        });
      });
    }
  }

  private addToggleBtn(text: TextComponent): void {
    const toggleBtn = text.inputEl.parentElement?.createEl("button", {
      text: "Show",
      cls: "neuro-vault-toggle-key",
    });
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        const isPassword = text.inputEl.type === "password";
        text.inputEl.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "Hide" : "Show";
      };
    }
  }

  private addApiKeyField(container: HTMLElement, provider: LLMProvider): void {
    const field = API_KEY_FIELDS[provider];
    const label =
      LLM_PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

    new Setting(container)
      .setName(`${label} API Key`)
      .setDesc(`API key for ${label}`)
      .addText((text) => {
        text
          .setPlaceholder("Enter API key")
          .setValue(
            String(
              (this.plugin.settings as unknown as Record<string, string>)[
                field
              ] ?? ""
            )
          );
        text.inputEl.type = "password";
        this.addToggleBtn(text);

        text.onChange((value) => {
          (
            this.plugin.settings as unknown as Record<string, string>
          )[field] = value;
          this.debouncedSave();
        });
      });
  }
}
