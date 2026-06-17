import type { VoiceTranscriber, VoiceTranscriptionOptions } from "./types";

export class DeepgramTranscriber implements VoiceTranscriber {
  readonly name = "Deepgram";

  async transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string> {
    const params = new URLSearchParams({
      smart_format: "true",
      model: "nova-3",
    });

    if (options.language) {
      params.set("language", options.language);
    }

    const url = `https://api.deepgram.com/v1/listen?${params.toString()}`;
    const buffer = await audioBlob.arrayBuffer();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioBlob.type || "audio/wav",
      },
      body: buffer,
      signal: options.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(
        `Deepgram failed (${res.status}): ${err?.err_msg ?? "unknown"}`
      );
    }

    const data = await res.json();
    const channels = data.results?.channels;
    if (!channels || channels.length === 0) {
      throw new Error("Deepgram returned no results");
    }

    return channels[0]?.alternatives?.[0]?.transcript ?? "";
  }
}
