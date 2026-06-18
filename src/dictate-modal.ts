import { App, Modal, Editor } from "obsidian";
import type NeuroVaultPlugin from "../main";
import { ASR_REGISTRY, getASRTranscriber } from "./voice-providers/registry";
import type { ASRProvider } from "./voice-providers/types";
import { callLLM } from "./llm-client";
import type { LLMProvider } from "./types";

const DEFAULT_CLEANUP_PROMPT =
  "You are a voice-to-text formatter. Clean up this voice transcription into proper written text. Fix punctuation, capitalization, and grammar. Remove filler words (um, uh, like, you know, o sea, eh, bueno, este). Format into clear paragraphs if the text is long enough. Keep the original meaning and tone exactly. Do not add content that was not spoken. Do not add commentary, explanations, or headers. Output only the cleaned text, nothing else.";

export class DictateModal extends Modal {
  private plugin: NeuroVaultPlugin;
  private editor: Editor;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private statusEl!: HTMLElement;
  private recordBtn!: HTMLButtonElement;
  private abortController: AbortController | null = null;

  constructor(app: App, plugin: NeuroVaultPlugin, editor: Editor) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("neuro-vault-dictate");

    this.statusEl = contentEl.createDiv("neuro-vault-dictate-status");
    this.statusEl.setText("Click to start recording");

    const btnContainer = contentEl.createDiv("neuro-vault-dictate-btns");

    this.recordBtn = btnContainer.createEl("button", {
      cls: "neuro-vault-dictate-record",
    });
    this.recordBtn.setText("\u{1F3A4}");
    this.recordBtn.addEventListener("click", () => {
      void this.toggleRecording();
    });

    const cancelBtn = btnContainer.createEl("button", {
      text: "Cancel",
      cls: "neuro-vault-dictate-cancel",
    });
    cancelBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.abortController?.abort();
    this.stopRecording();
    this.contentEl.empty();
  }

  private async toggleRecording(): Promise<void> {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
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
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        void this.processAudio();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordBtn.setText("\u{23F9}");
      this.recordBtn.addClass("neuro-vault-dictate-recording");
      this.statusEl.setText("Recording... click stop when done");
    } catch {
      this.statusEl.setText("Could not access microphone");
    }
  }

  private stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.isRecording = false;
    this.recordBtn.setText("\u{1F3A4}");
    this.recordBtn.removeClass("neuro-vault-dictate-recording");
  }

  private async processAudio(): Promise<void> {
    if (this.audioChunks.length === 0) return;

    const audioBlob = new Blob(this.audioChunks, {
      type: this.audioChunks[0]?.type || "audio/webm",
    });
    this.audioChunks = [];
    this.abortController = new AbortController();

    const asrProvider = this.plugin.settings.asrProvider;
    const asrMeta = ASR_REGISTRY[asrProvider];
    const apiKey = this.getASRApiKey(asrProvider);

    if (!apiKey) {
      this.statusEl.setText(`No API key for ${asrMeta?.label || asrProvider}`);
      return;
    }

    this.recordBtn.disabled = true;
    this.statusEl.setText("Transcribing...");

    const transcriber = getASRTranscriber(asrProvider);
    let rawText: string;
    try {
      rawText = await transcriber.transcribe(audioBlob, apiKey, {
        language: this.plugin.settings.asrLanguage || "es",
        signal: this.abortController.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      this.statusEl.setText(
        `Transcription error: ${err instanceof Error ? err.message : "failed"}`
      );
      this.recordBtn.disabled = false;
      return;
    }

    if (!rawText.trim()) {
      this.statusEl.setText("No speech detected");
      this.recordBtn.disabled = false;
      return;
    }

    this.statusEl.setText("Formatting with AI...");

    const llmProvider = this.plugin.settings.llmProvider;
    const llmApiKey = this.plugin.getApiKey(llmProvider);
    const model = this.plugin.getModel(llmProvider);
    const cleanupPrompt =
      this.plugin.settings.dictateCleanupPrompt || DEFAULT_CLEANUP_PROMPT;

    try {
      const cleaned = await callLLM(
        llmProvider as LLMProvider,
        llmApiKey,
        model,
        `${cleanupPrompt}\n\n---\n\n${rawText}`
      );

      this.editor.replaceSelection(cleaned);
      this.close();
    } catch (err) {
      this.statusEl.setText(
        `Format error: ${err instanceof Error ? err.message : "failed"}`
      );
      this.recordBtn.disabled = false;
    }
  }

  private getASRApiKey(provider: string): string {
    const meta = ASR_REGISTRY[provider as ASRProvider];
    if (!meta) return "";
    const settings = this.plugin.settings as unknown as Record<string, string>;
    return settings[meta.apiKeyField] ?? "";
  }
}
