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
      const err = await uploadRes.json().catch(() => null);
      throw new Error(
        `Gladia upload failed (${uploadRes.status}): ${err?.message ?? "unknown"}`
      );
    }

    const { audio_url: audioUrl } = await uploadRes.json();

    const transcribeRes = await fetch(`${baseUrl}/pre-recorded`, {
      method: "POST",
      headers: {
        "x-gladia-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_config: {
          languages: [options.language || "es"],
        },
      }),
      signal: options.signal,
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.json().catch(() => null);
      throw new Error(
        `Gladia transcription failed (${transcribeRes.status}): ${err?.message ?? "unknown"}`
      );
    }

    const { result_url: resultUrl } = await transcribeRes.json();

    return this.poll(resultUrl, apiKey, options.signal);
  }

  private async poll(
    resultUrl: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string> {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch(resultUrl, {
        headers: { "x-gladia-key": apiKey },
        signal,
      });

      if (!res.ok) {
        throw new Error(`Gladia polling failed (${res.status})`);
      }

      const data = await res.json();

      if (data.status === "done") {
        const utterances = data.result?.transcription?.utterances ?? [];
        return utterances.map((u: { text: string }) => u.text).join(" ");
      }

      if (data.status === "error") {
        throw new Error("Gladia transcription failed");
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error("Gladia transcription timed out");
  }
}
