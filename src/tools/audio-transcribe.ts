import { App, TFile, normalizePath } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";
import { ASR_REGISTRY } from "../voice-providers/registry";
import type { ASRProvider } from "../types";

registerTool(
  {
    name: "transcribe_audio",
    description: "Transcribe an audio file from the vault using the configured ASR provider (Deepgram, AssemblyAI, Gladia, or Groq)",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to audio file in the vault (mp3, wav, m4a, ogg)",
        },
      },
      required: ["path"],
    },
  },
  async (app, args) => {
    const rawPath = String(args.path ?? "").trim();
    if (!rawPath) return JSON.stringify({ error: "Missing path" });

    const normalized = normalizePath(rawPath);
    const file = app.vault.getAbstractFileByPath(normalized);
    if (!file || !(file instanceof TFile)) {
      return JSON.stringify({ error: `File not found: ${normalized}` });
    }

    const plugin = getPluginInstance();
    if (!plugin) return JSON.stringify({ error: "Plugin not initialized." });

    const providerId = plugin.settings.asrProvider as ASRProvider;
    const meta = ASR_REGISTRY[providerId];
    if (!meta) {
      return JSON.stringify({ error: `Unknown ASR provider: ${providerId}` });
    }

    const apiKey = (plugin.settings as unknown as Record<string, string>)[meta.apiKeyField];
    if (!apiKey) {
      return JSON.stringify({ error: `${meta.label} API key not configured. Set it in Settings → Neuro Vault → Voice.` });
    }

    try {
      const arrayBuffer = await app.vault.readBinary(file);
      const blob = new Blob([arrayBuffer]);
      const text = await meta.transcriber.transcribe(blob, apiKey, { language: plugin.settings.asrLanguage });
      return JSON.stringify({ text, path: file.path, provider: providerId });
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);
