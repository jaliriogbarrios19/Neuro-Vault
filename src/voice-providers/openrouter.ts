import type { VoiceTranscriber, VoiceTranscriptionOptions } from "./types";

export class OpenRouterTranscriber implements VoiceTranscriber {
  readonly name = "OpenRouter";

  async transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string> {
    const model = options.model || "microsoft/mai-transcribe-1.5";

    const form = new FormData();
    form.append("file", audioBlob, "audio.webm");
    form.append("model", model);

    if (options.language) {
      form.append("language", options.language);
    }

    const res = await fetch("https://openrouter.ai/api/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      signal: options.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `OpenRouter transcription failed (${res.status}): ${err.slice(0, 200)}`
      );
    }

    const data = await res.json();
    return data.text ?? "";
  }
}
