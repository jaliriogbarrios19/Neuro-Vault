export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface ToolResult {
  toolCallId: string;
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>, id: string) => void;
  onToolResult: (result: ToolResult) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "gemini"
  | "openrouter"
  | "grok"
  | "glm"
  | "spob";

export interface LLMModel {
  modelId: string;
  label: string;
  description: string;
}

export const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "gemini", label: "Google Gemini" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "grok", label: "Grok (xAI)" },
  { value: "glm", label: "GLM (Z.ai)" },
  { value: "spob", label: "Smart Plugins Obsidian" },
];

export const LLM_MODELS: Record<LLMProvider, LLMModel[]> = {
  openai: [
    { modelId: "gpt-5.5", label: "GPT-5.5", description: "Flagship. 1M ctx." },
    { modelId: "gpt-5.4", label: "GPT-5.4", description: "Best value." },
    { modelId: "gpt-oss-120b", label: "GPT-OSS 120B", description: "Open weights." },
    { modelId: "gpt-oss-20b", label: "GPT-OSS 20B", description: "Open weights, smaller." },
  ],
  anthropic: [
    { modelId: "claude-opus-4-8-20260514", label: "Claude Opus 4.8", description: "Flagship. May 2026." },
    { modelId: "claude-sonnet-4-6-20260514", label: "Claude Sonnet 4.6", description: "Balanced." },
    { modelId: "claude-haiku-3-5-20241022", label: "Claude Haiku 3.5", description: "Fast, near-frontier." },
    { modelId: "claude-sonnet-4-0", label: "Claude Sonnet 4.0", description: "Previous." },
  ],
  deepseek: [
    { modelId: "deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "Top-tier. 1M ctx." },
    { modelId: "deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "Fast. 1M ctx." },
  ],
  gemini: [
    { modelId: "gemini-3.5-flash", label: "Gemini 3.5 Flash", description: "Latest." },
    { modelId: "gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Flagship." },
    { modelId: "gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "Fast." },
    { modelId: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", description: "Lightweight." },
  ],
  openrouter: [
    // Tier 1 - Ultra Económico
    { modelId: "openai/gpt-5-nano", label: "GPT-5 Nano", description: "Ultra econ. 400K ctx." },
    { modelId: "qwen/qwen3.5-flash-02-23", label: "Qwen 3.5 Flash", description: "1M ctx. Reasoning." },
    { modelId: "qwen/qwen3-coder-30b-a3b-instruct", label: "Qwen3 Coder 30B", description: "Código. Tool calling." },
    { modelId: "mistralai/mistral-small-3.2-24b-instruct", label: "Mistral Small 3.2", description: "Compacto. Tool calling." },
    { modelId: "qwen/qwen3-32b", label: "Qwen3 32B", description: "Versátil. Código." },
    { modelId: "google/gemma-3-27b-it", label: "Gemma 3 27B", description: "Open source. Rápido." },
    { modelId: "qwen/qwen3-235b-a22b-2507", label: "Qwen3 235B", description: "Masivo MoE. Barato." },
    { modelId: "nvidia/nemotron-3-super-120b-a12b", label: "Nemotron 120B", description: "1M ctx. NVIDIA." },
    { modelId: "stepfun/step-3.5-flash", label: "Step 3.5 Flash", description: "Cache 78%. Rápido." },
    { modelId: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash", description: "1M ctx. Cache 80%." },
    { modelId: "meta-llama/llama-4-scout", label: "Llama 4 Scout", description: "10M ctx! Meta." },
    { modelId: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", description: "1M ctx. Cache 90%." },
    { modelId: "google/gemma-4-31b-it", label: "Gemma 4 31B", description: "Open source. 262K ctx." },
    // Tier 2 - Mejor Relación
    { modelId: "openai/gpt-4o-mini", label: "GPT-4o Mini", description: "Estándar. Visión." },
    { modelId: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", description: "MoE 1M ctx. Código." },
    { modelId: "anthropic/claude-3-haiku", label: "Claude 3 Haiku", description: "Rápido. Cache 88%." },
    { modelId: "deepseek/deepseek-r1-distill-qwen-32b", label: "DeepSeek R1 Distill", description: "Reasoning barato." },
    { modelId: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", description: "1M ctx. Reasoning." },
    { modelId: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro", description: "1M ctx. Cache 99%." },
    { modelId: "xiaomi/mimo-v2.5-pro", label: "MiMo 2.5 Pro", description: "1M ctx. Cache 99%." },
    // Tier 3 - Premium Accesible
    { modelId: "mistralai/mistral-large-2512", label: "Mistral Large", description: "Top Mistral. Cache 90%." },
    { modelId: "deepseek/deepseek-r1", label: "DeepSeek R1", description: "Reasoning profundo." },
    { modelId: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", description: "Rápido. Cache 90%." },
    { modelId: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", description: "Top Google. 1M ctx." },
    { modelId: "openai/gpt-4o", label: "GPT-4o", description: "Multimodal. Visión." },
    { modelId: "cohere/command-a", label: "Command A", description: "RAG. Tool calling." },
    { modelId: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6", description: "Top Sonnet. Código." },
    { modelId: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", description: "Código complejo." },
    { modelId: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8", description: "El más capaz." },
    { modelId: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", description: "Código. Tool calling." },
    { modelId: "tencent/hy3-preview", label: "Hunyuan 3 Preview", description: "Reasoning. Multimodal." },
  ],
  grok: [
    { modelId: "grok-4.3", label: "Grok 4.3", description: "Flagship." },
    { modelId: "grok-build", label: "Grok Build", description: "Coding agent." },
    { modelId: "grok-4.0", label: "Grok 4.0", description: "Previous." },
    { modelId: "grok-3.0", label: "Grok 3.0", description: "Previous." },
  ],
  glm: [
    { modelId: "glm-5", label: "GLM-5", description: "Flagship. Feb 2026." },
    { modelId: "glm-4.5-plus", label: "GLM-4.5 Plus", description: "Top-tier." },
    { modelId: "glm-4.5-flash", label: "GLM-4.5 Flash", description: "Fast." },
    { modelId: "glm-4-plus", label: "GLM-4 Plus", description: "Previous." },
  ],
  spob: [
    { modelId: "deepseek-v4-pro", label: "DeepSeek V4 Pro (spob)", description: "Via spob." },
    { modelId: "deepseek-v4-flash", label: "DeepSeek V4 Flash (spob)", description: "Via spob." },
  ],
};

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-5.5",
  anthropic: "claude-opus-4-8-20260514",
  deepseek: "deepseek-v4-pro",
  gemini: "gemini-3.5-flash",
  openrouter: "openai/gpt-5.5",
  grok: "grok-4.3",
  glm: "glm-5",
  spob: "deepseek-v4-pro",
};

export interface AcademicWork {
  doi: string;
  title: string;
  authors: { name: string }[];
  year: number;
  journal: string;
  abstract_text: string;
  relevance_score: number;
  url: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export type MemoryCategory =
  | "personal"
  | "academic"
  | "health"
  | "family"
  | "social"
  | "other";

export interface Memory {
  id: string;
  content: string;
  category: MemoryCategory;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ASRProvider =
  | "deepgram"
  | "assemblyai"
  | "gladia"
  | "groq";

export interface PluginSettings {
  llmProvider: LLMProvider;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  deepseekApiKey: string;
  deepseekModel: string;
  geminiApiKey: string;
  geminiModel: string;
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterCustomModels?: LLMModel[];
  grokApiKey: string;
  grokModel: string;
  glmApiKey: string;
  glmModel: string;
  spobApiKey: string;
  spobModel: string;
  spobBaseUrl: string;
  braveApiKey: string;
  tavilyApiKey: string;
  searxngUrl: string;
  webSearchProvider: "brave" | "tavily" | "searxng" | "duckduckgo";
  pubmedApiKey: string;
  crossrefEmail: string;
  systemPrompt: string;
  conversationMessages?: ChatMessage[];
  chatSessions?: ChatSession[];
  activeSessionId?: string;
  flashMode?: boolean;
  agentMode?: "chat" | "agent";
  chatTheme?: "obsidian" | "dark" | "light";
  asrProvider: ASRProvider;
  deepgramApiKey: string;
  assemblyaiApiKey: string;
  gladiaApiKey: string;
  groqApiKey: string;
  asrLanguage: string;
  dictateCleanupPrompt: string;
  enableMemory: boolean;
  autoExtractMemory: boolean;
  memories?: Memory[];
  maxMemories: number;
}

export const API_KEY_FIELDS: Record<LLMProvider, keyof PluginSettings> = {
  openai: "openaiApiKey",
  anthropic: "anthropicApiKey",
  deepseek: "deepseekApiKey",
  gemini: "geminiApiKey",
  openrouter: "openrouterApiKey",
  grok: "grokApiKey",
  glm: "glmApiKey",
  spob: "spobApiKey",
};

export const MODEL_FIELDS: Record<LLMProvider, keyof PluginSettings> = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  deepseek: "deepseekModel",
  gemini: "geminiModel",
  openrouter: "openrouterModel",
  grok: "grokModel",
  glm: "glmModel",
  spob: "spobModel",
};
