import type { VoiceTranscriber, VoiceTranscriptionOptions } from "./types";

export class GladiaTranscriber implements VoiceTranscriber {
  readonly name = "Gladia";

  async transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string> {
    const baseUrl = "https://api.gladia.io/v2";

    const form = new FormData();
    form.append("audio", audioBlob);

    const uploadRes = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      headers: { "x-gladia-key": apiKey },
      body: form,
      signal: options.signal,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => null) as { message?: string } | null;
      throw new Error(
        `Gladia upload failed (${uploadRes.status}): ${err?.message ?? "unknown"}`
      );
    }

    const uploadData = await uploadRes.json() as { audio_url: string };
    const audioUrl = uploadData.audio_url;

    const transcribeRes = await fetch(`${baseUrl}/pre-recorded`, {
      method: "POST",
      headers: {
        "x-gladia-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        model: options.model || "solaria-3",
        diarization: true,
        language_config: {
          languages: [options.language || "es"],
        },
      }),
      signal: options.signal,
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.json().catch(() => null) as { message?: string } | null;
      throw new Error(
        `Gladia transcription failed (${transcribeRes.status}): ${err?.message ?? "unknown"}`
      );
    }

    const transcribeData = await transcribeRes.json() as { result_url: string };
    return this.poll(transcribeData.result_url, apiKey, options.signal);
  }

  private async poll(
    resultUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string> {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch(resultUrl, {
        headers: { "x-gladia-key": apiKey },
        signal,
      });

      if (!res.ok) {
        throw new Error(`Gladia polling failed (${res.status})`);
      }

      const data = await res.json() as GladiaResult;

      if (data.status === "done") {
        const utterances = data.result?.transcription?.utterances ?? [];
        if (utterances.length > 0) {
          return utterances.map((u) => u.text.trim()).join(" ");
        }
        return data.result?.transcription?.full_transcript ?? "";
      }

      if (data.status === "error") {
        throw new Error("Gladia transcription failed");
      }

      await new Promise((r) => window.setTimeout(r, 1000));
    }

    throw new Error("Gladia transcription timed out");
  }
}

interface GladiaResult {
  status: string;
  result?: {
    transcription?: {
      full_transcript?: string;
      utterances?: Array<{
        speaker: number;
        text: string;
        start: number;
        end: number;
      }>;
    };
  };
}
