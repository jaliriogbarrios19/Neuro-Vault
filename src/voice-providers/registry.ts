import type { ASRProvider, ASRProviderMeta, VoiceTranscriber } from "./types";
import { DeepgramTranscriber } from "./deepgram";
import { AssemblyAITranscriber } from "./assemblyai";
import { GladiaTranscriber } from "./gladia";
import { GroqTranscriber } from "./groq";

export const ASR_PROVIDERS: { value: ASRProvider; label: string }[] = [
  { value: "deepgram", label: "Deepgram" },
  { value: "assemblyai", label: "AssemblyAI" },
  { value: "gladia", label: "Gladia" },
  { value: "groq", label: "Groq (Whisper)" },
];

export const ASR_REGISTRY: Record<ASRProvider, ASRProviderMeta> = {
  deepgram: {
    id: "deepgram",
    label: "Deepgram",
    transcriber: new DeepgramTranscriber(),
    apiKeyField: "deepgramApiKey",
    requiresApiKey: true,
  },
  assemblyai: {
    id: "assemblyai",
    label: "AssemblyAI",
    transcriber: new AssemblyAITranscriber(),
    apiKeyField: "assemblyaiApiKey",
    requiresApiKey: true,
  },
  gladia: {
    id: "gladia",
    label: "Gladia",
    transcriber: new GladiaTranscriber(),
    apiKeyField: "gladiaApiKey",
    requiresApiKey: true,
  },
  groq: {
    id: "groq",
    label: "Groq (Whisper)",
    transcriber: new GroqTranscriber(),
    apiKeyField: "groqApiKey",
    requiresApiKey: true,
  },
};

export function getASRTranscriber(provider: ASRProvider): VoiceTranscriber {
  return ASR_REGISTRY[provider].transcriber;
}

export function getASRKeyField(provider: ASRProvider): string {
  return ASR_REGISTRY[provider].apiKeyField;
}
