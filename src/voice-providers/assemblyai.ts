import type { VoiceTranscriber, VoiceTranscriptionOptions } from "./types";

export class AssemblyAITranscriber implements VoiceTranscriber {
  readonly name = "AssemblyAI";

  async transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string> {
    const baseUrl = "https://api.assemblyai.com";

    const buffer = await audioBlob.arrayBuffer();
    const contentType = audioBlob.type || "application/octet-stream";

    const uploadRes = await fetch(`${baseUrl}/v2/upload`, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": contentType,
      },
      body: buffer,
      signal: options.signal,
    });

    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      throw new Error(`AssemblyAI upload failed (${uploadRes.status}): ${body.slice(0, 200)}`);
    }

    const { upload_url: audioUrl } = await uploadRes.json();

    const transcriptRes = await fetch(`${baseUrl}/v2/transcript`, {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: options.language || "es",
        model: options.model || "best",
      }),
      signal: options.signal,
    });

    if (!transcriptRes.ok) {
      const err = await transcriptRes.text();
      throw new Error(`AssemblyAI transcript failed (${transcriptRes.status}): ${err.slice(0, 200)}`);
    }

    const { id } = await transcriptRes.json();

    return this.poll(id, apiKey, options.signal);
  }

  private async poll(
    id: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string> {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: apiKey },
        signal,
      });

      if (!res.ok) {
        throw new Error(`AssemblyAI polling failed (${res.status})`);
      }

      const data = await res.json();

      if (data.status === "completed") {
        return data.text ?? "";
      }

      if (data.status === "error") {
        throw new Error(`AssemblyAI error: ${data.error ?? "unknown"}`);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }

    throw new Error("AssemblyAI transcription timed out");
  }
}
