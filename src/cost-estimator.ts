export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const PRICING: Record<string, ModelPricing> = {
  "gpt-5.5":                  { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "gpt-5.4":                  { inputPer1M: 1.25,  outputPer1M: 5.00 },
  "gpt-oss-120b":             { inputPer1M: 0.50,  outputPer1M: 1.50 },
  "gpt-oss-20b":              { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "claude-opus-4-8-20260514": { inputPer1M: 15.00, outputPer1M: 75.00 },
  "claude-sonnet-4-6-20260514": { inputPer1M: 3.00, outputPer1M: 15.00 },
  "claude-haiku-3-5-20241022":{ inputPer1M: 0.80,  outputPer1M: 4.00 },
  "claude-sonnet-4-0":        { inputPer1M: 3.00,  outputPer1M: 15.00 },
  "deepseek-v4-pro":          { inputPer1M: 0.50,  outputPer1M: 1.50 },
  "deepseek-v4-flash":        { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "gemini-3.5-flash":         { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "gemini-2.5-pro":           { inputPer1M: 1.25,  outputPer1M: 5.00 },
  "gemini-2.5-flash":         { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "gemini-2.5-flash-lite":    { inputPer1M: 0.075, outputPer1M: 0.30 },
  "grok-4.3":                 { inputPer1M: 3.00,  outputPer1M: 15.00 },
  "grok-build":               { inputPer1M: 0.50,  outputPer1M: 2.00 },
  "grok-4.0":                 { inputPer1M: 2.00,  outputPer1M: 10.00 },
  "grok-3.0":                 { inputPer1M: 1.00,  outputPer1M: 5.00 },
  "glm-5":                    { inputPer1M: 2.00,  outputPer1M: 8.00 },
  "glm-4.5-plus":             { inputPer1M: 1.00,  outputPer1M: 4.00 },
  "glm-4.5-flash":            { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "glm-4-plus":               { inputPer1M: 0.50,  outputPer1M: 2.00 },
  // OpenRouter models
  "openai/gpt-5-nano":        { inputPer1M: 0.05,  outputPer1M: 0.20 },
  "qwen/qwen3.5-flash-02-23": { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "qwen/qwen3-coder-30b-a3b-instruct": { inputPer1M: 0.10, outputPer1M: 0.30 },
  "mistralai/mistral-small-3.2-24b-instruct": { inputPer1M: 0.10, outputPer1M: 0.30 },
  "qwen/qwen3-32b":           { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "google/gemma-3-27b-it":    { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "qwen/qwen3-235b-a22b-2507": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "nvidia/nemotron-3-super-120b-a12b": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "stepfun/step-3.5-flash":   { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "deepseek/deepseek-v4-flash": { inputPer1M: 0.10, outputPer1M: 0.30 },
  "meta-llama/llama-4-scout": { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "google/gemini-2.5-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.30 },
  "google/gemma-4-31b-it":    { inputPer1M: 0.10,  outputPer1M: 0.30 },
  "openai/gpt-4o-mini":       { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "meta-llama/llama-4-maverick": { inputPer1M: 0.20, outputPer1M: 0.80 },
  "anthropic/claude-3-haiku": { inputPer1M: 0.25,  outputPer1M: 1.25 },
  "deepseek/deepseek-r1-distill-qwen-32b": { inputPer1M: 0.10, outputPer1M: 0.30 },
  "google/gemini-2.5-flash":  { inputPer1M: 0.15,  outputPer1M: 0.60 },
  "deepseek/deepseek-v4-pro": { inputPer1M: 0.50,  outputPer1M: 1.50 },
  "xiaomi/mimo-v2.5-pro":     { inputPer1M: 0.50,  outputPer1M: 1.50 },
  "mistralai/mistral-large-2512": { inputPer1M: 1.00, outputPer1M: 4.00 },
  "deepseek/deepseek-r1":     { inputPer1M: 0.50,  outputPer1M: 2.00 },
  "anthropic/claude-haiku-4.5": { inputPer1M: 0.80, outputPer1M: 4.00 },
  "google/gemini-2.5-pro":    { inputPer1M: 1.25,  outputPer1M: 5.00 },
  "openai/gpt-4o":            { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "cohere/command-a":         { inputPer1M: 0.50,  outputPer1M: 1.50 },
  "anthropic/claude-sonnet-4.6": { inputPer1M: 3.00, outputPer1M: 15.00 },
  "anthropic/claude-sonnet-4.5": { inputPer1M: 3.00, outputPer1M: 15.00 },
  "anthropic/claude-opus-4.8": { inputPer1M: 15.00, outputPer1M: 75.00 },
  "anthropic/claude-sonnet-4": { inputPer1M: 3.00,  outputPer1M: 15.00 },
  "tencent/hy3-preview":      { inputPer1M: 1.00,  outputPer1M: 4.00 },
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  modelId: string,
  inputText: string,
  outputText: string
): CostEstimate {
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  const pricing = PRICING[modelId];

  if (!pricing) {
    return { inputTokens, outputTokens, inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    inputTokens,
    outputTokens,
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

export function formatCost(estimate: CostEstimate): string {
  const total = estimate.totalCost;
  if (total === 0) return `${estimate.inputTokens + estimate.outputTokens} tok`;
  if (total < 0.01) return `${estimate.inputTokens + estimate.outputTokens} tok · <$0.01`;
  return `${estimate.inputTokens + estimate.outputTokens} tok · $${total.toFixed(3)}`;
}
