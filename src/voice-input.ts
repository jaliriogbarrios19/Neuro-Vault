import type { ASRProvider, PluginSettings } from "./types";
import { ASR_REGISTRY, getASRTranscriber } from "./voice-providers/registry";

export class VoiceInput {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isListening = false;
  private btnEl: HTMLElement | null = null;
  private inputEl: HTMLTextAreaElement | null = null;
  private plugin: { settings: PluginSettings };
  private abortController: AbortController | null = null;

  constructor(plugin: { settings: PluginSettings }) {
    this.plugin = plugin;
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  attach(btn: HTMLElement, inputEl: HTMLTextAreaElement): void {
    if (!this.isSupported()) {
      btn.classList.add("nv-hidden");
      return;
    }
    this.btnEl = btn;
    this.inputEl = inputEl;
    btn.addEventListener("click", () => this.toggle());
  }

  private async toggle(): Promise<void> {
    if (this.isListening) {
      this.stop();
    } else {
      await this.start();
    }
  }

  private async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => this.transcribe();

      this.mediaRecorder.start();
      this.isListening = true;
      this.updateBtn();
    } catch (err) {
      console.error("VoiceInput: failed to start recording", err);
    }
  }

  private stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.isListening = false;
    this.updateBtn();
  }

  private async transcribe(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, { type: this.audioChunks[0]?.type || "audio/webm" });
    this.audioChunks = [];

    const provider = this.plugin.settings.asrProvider;
    const apiKey = this.getApiKey(provider);
    if (!apiKey) {
      console.error(`VoiceInput: no API key for ${provider}`);
      return;
    }

    const transcriber = getASRTranscriber(provider);
    this.abortController = new AbortController();

    try {
      const text = await transcriber.transcribe(audioBlob, apiKey, {
        language: this.plugin.settings.asrLanguage || "es",
        signal: this.abortController.signal,
      });

      if (text && this.inputEl) {
        this.inputEl.value = text;
        this.inputEl.dispatchEvent(new Event("input"));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error(`VoiceInput: transcription failed`, err);
    } finally {
      this.abortController = null;
    }
  }

  private getApiKey(provider: ASRProvider): string {
    const meta = ASR_REGISTRY[provider];
    if (!meta) return "";
    const settings = this.plugin.settings as unknown as Record<string, string>;
    return settings[meta.apiKeyField] ?? "";
  }

  private updateBtn(): void {
    if (!this.btnEl) return;
    this.btnEl.classList.toggle("neuro-vault-voice-active", this.isListening);
    this.btnEl.textContent = this.isListening ? "⏹" : "🎤";
  }

  destroy(): void {
    this.abortController?.abort();
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
