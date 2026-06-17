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
