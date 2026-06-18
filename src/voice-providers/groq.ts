import type { VoiceTranscriber, VoiceTranscriptionOptions } from "./types";

export class GroqTranscriber implements VoiceTranscriber {
  readonly name = "Groq (Whisper)";

  async transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string> {
    const form = new FormData();
    form.append("file", audioBlob, "audio.webm");
    form.append("model", options.model || "whisper-large-v3-turbo");
    form.append("response_format", "text");

    if (options.language) {
      form.append("language", options.language);
    }

    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: options.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(
        `Groq transcription failed (${res.status}): ${err?.error?.message ?? "unknown"}`
      );
    }

    const data = await res.json() as { text?: string };
    return data.text ?? "";
  }
}
