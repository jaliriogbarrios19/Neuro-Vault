import { App, TFile, normalizePath } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";

registerTool(
  {
    name: "transcribe_audio",
    description: "Transcribe an audio file from the vault using OpenAI Whisper",
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
    const apiKey = plugin?.settings.openaiApiKey;
    if (!apiKey) {
      return JSON.stringify({ error: "OpenAI API key not configured. Set it in Settings → Neuro Vault." });
    }

    try {
      const arrayBuffer = await app.vault.readBinary(file);
      const formData = new FormData();
      const blob = new Blob([arrayBuffer]);
      formData.append("file", blob, file.name);
      formData.append("model", "whisper-1");

      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        return JSON.stringify({ error: `Whisper HTTP ${res.status}: ${err.slice(0, 200)}` });
      }

      const data = await res.json();
      return JSON.stringify({ text: data.text, path: file.path });
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);
