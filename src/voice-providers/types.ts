export interface VoiceTranscriber {
  readonly name: string;
  transcribe(
    audioBlob: Blob,
    apiKey: string,
    options: VoiceTranscriptionOptions
  ): Promise<string>;
}

export interface VoiceTranscriptionOptions {
  language?: string;
  signal?: AbortSignal;
  model?: string;
}

export type ASRProvider =
  | "deepgram"
  | "assemblyai"
  | "gladia"
  | "groq";

export interface ASRProviderMeta {
  id: ASRProvider;
  label: string;
  transcriber: VoiceTranscriber;
  apiKeyField: string;
  modelField?: string;
  requiresApiKey: boolean;
}
