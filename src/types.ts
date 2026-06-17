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
    { modelId: "openai/gpt-5.5", label: "GPT-5.5 (via OR)", description: "Via OpenRouter" },
    { modelId: "anthropic/claude-opus-4-8-20260514", label: "Claude Opus 4.8 (via OR)", description: "Via OpenRouter" },
    { modelId: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro (via OR)", description: "Via OpenRouter" },
    { modelId: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash (via OR)", description: "Via OpenRouter" },
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
  webSearchProvider: "brave" | "tavily" | "searxng";
  pubmedApiKey: string;
  crossrefEmail: string;
  systemPrompt: string;
  conversationMessages?: ChatMessage[];
  chatSessions?: ChatSession[];
  activeSessionId?: string;
  flashMode?: boolean;
  agentMode?: "chat" | "agent";
  chatTheme?: "obsidian" | "dark" | "light";
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
