import { App, PluginSettingTab, Setting, TextComponent, Notice } from "obsidian";
import type NeuroVaultPlugin from "../main";
import {
  LLMProvider,
  LLM_PROVIDERS,
  LLM_MODELS,
  LLMModel,
  PluginSettings,
  API_KEY_FIELDS,
  MODEL_FIELDS,
  DEFAULT_MODELS,
  ASRProvider,
} from "./types";
import { fetchOpenRouterModels, mergeOpenRouterModels } from "./openrouter-api";
import { ModelAutocomplete } from "./model-autocomplete";

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
  asrProvider: "deepgram",
  deepgramApiKey: "",
  assemblyaiApiKey: "",
  gladiaApiKey: "",
  groqApiKey: "",
  asrLanguage: "es",
  dictateCleanupPrompt: "You are a voice-to-text formatter. Clean up this voice transcription into proper written text. Fix punctuation, capitalization, and grammar. Remove filler words (um, uh, like, you know, o sea, eh, bueno, este). Format into clear paragraphs if the text is long enough. Keep the original meaning and tone exactly. Do not add content that was not spoken. Do not add commentary, explanations, or headers. Output only the cleaned text, nothing else.",
};

export class SettingsTab extends PluginSettingTab {
  plugin: NeuroVaultPlugin;
  private saveTimeout: number | null = null;
  private modelAutocomplete?: ModelAutocomplete;

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
    const chatView = this.plugin.getActiveChatView();
    if (chatView) chatView.refreshFromSettings();
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
      const current =
        String(
          (this.plugin.settings as unknown as Record<string, string>)[
            modelField
          ]
        ) || DEFAULT_MODELS[provider];
      const currentModel = models.find((m) => m.modelId === current);

      const modelSetting = new Setting(containerEl)
        .setName("Model")
        .setDesc("AI model for chat")
        .addButton((btn) => {
          btn.setButtonText(currentModel?.label || current);
          const autocomplete = new ModelAutocomplete(
            btn.buttonEl,
            models,
            async (modelId) => {
              (this.plugin.settings as unknown as Record<string, string>)[modelField] = modelId;
              await this.plugin.saveSettings();
              const updated = models.find((m) => m.modelId === modelId);
              btn.setButtonText(updated?.label || modelId);
            }
          );

          if (provider === "openrouter") {
            this.modelAutocomplete = autocomplete;
          }
        });

      if (provider === "openrouter") {
        modelSetting.addButton((btn) =>
          btn
            .setButtonText("Import from OpenRouter")
            .setCta()
            .onClick(async () => {
              const apiKey = this.plugin.settings.openrouterApiKey;
              if (!apiKey) {
                new Notice("Set your OpenRouter API key first");
                return;
              }
              btn.setButtonText("Fetching...").setDisabled(true);
              try {
                const fetched = await fetchOpenRouterModels(apiKey);
                const curated = LLM_MODELS.openrouter;
                const merged = mergeOpenRouterModels(curated, fetched);
                LLM_MODELS.openrouter = merged;
                this.plugin.settings.openrouterCustomModels = merged;
                await this.plugin.saveSettings();
                new Notice(`Imported ${fetched.length} models from OpenRouter`);
                this.display();
              } catch (e) {
                new Notice(`Error: ${e instanceof Error ? e.message : String(e)}`);
              } finally {
                btn.setButtonText("Import from OpenRouter").setDisabled(false);
              }
            })
        );
      }
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
        dropdown.addOption("duckduckgo", "DuckDuckGo (free, no API key)");
        dropdown
          .setValue(this.plugin.settings.webSearchProvider)
          .onChange(async (v) => {
            this.plugin.settings.webSearchProvider = v as "brave" | "tavily" | "searxng" | "duckduckgo";
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

    new Setting(containerEl).setName("Voice Input (ASR)").setHeading();

    new Setting(containerEl)
      .setName("ASR Provider")
      .setDesc("Provider for voice-to-text transcription")
      .addDropdown((dropdown) => {
        dropdown.addOption("deepgram", "Deepgram");
        dropdown.addOption("assemblyai", "AssemblyAI");
        dropdown.addOption("gladia", "Gladia");
        dropdown.addOption("groq", "Groq (Whisper)");
        dropdown
          .setValue(this.plugin.settings.asrProvider)
          .onChange(async (v) => {
            this.plugin.settings.asrProvider = v as ASRProvider;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    const asrProvider = this.plugin.settings.asrProvider;

    if (asrProvider === "deepgram") {
      new Setting(containerEl)
        .setName("Deepgram API Key")
        .setDesc("Free tier: https://console.deepgram.com/signup")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.deepgramApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.deepgramApiKey = value;
            this.debouncedSave();
          });
        });
    }

    if (asrProvider === "assemblyai") {
      new Setting(containerEl)
        .setName("AssemblyAI API Key")
        .setDesc("Free tier: https://www.assemblyai.com/dashboard")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.assemblyaiApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.assemblyaiApiKey = value;
            this.debouncedSave();
          });
        });
    }

    if (asrProvider === "gladia") {
      new Setting(containerEl)
        .setName("Gladia API Key")
        .setDesc("Free tier: https://gladia.io")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.gladiaApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.gladiaApiKey = value;
            this.debouncedSave();
          });
        });
    }

    if (asrProvider === "groq") {
      new Setting(containerEl)
        .setName("Groq API Key")
        .setDesc("Free: https://console.groq.com")
        .addText((text) => {
          text.setPlaceholder("Enter API key").setValue(this.plugin.settings.groqApiKey);
          text.inputEl.type = "password";
          this.addToggleBtn(text);
          text.onChange((value) => {
            this.plugin.settings.groqApiKey = value;
            this.debouncedSave();
          });
        });
    }

    new Setting(containerEl)
      .setName("ASR Language")
      .setDesc("Language for transcription (ISO 639-1 code, e.g. es, en)")
      .addText((text) => {
        text
          .setPlaceholder("es")
          .setValue(this.plugin.settings.asrLanguage)
          .onChange((value) => {
            this.plugin.settings.asrLanguage = value;
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
      .setName("Dictate Cleanup Prompt")
      .setDesc("Prompt used to clean up voice transcriptions into written text. Leave empty for default.")
      .addTextArea((text) => {
        text
          .setPlaceholder("Default: Clean up transcription, fix grammar, remove fillers...")
          .setValue(this.plugin.settings.dictateCleanupPrompt)
          .onChange((value) => {
            this.plugin.settings.dictateCleanupPrompt = value;
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
