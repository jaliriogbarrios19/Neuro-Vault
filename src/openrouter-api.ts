import { requestUrl } from "obsidian";
import type { LLMModel } from "./types";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: string;
    completion: string;
    image?: string;
  };
  context_length?: number;
  architecture?: {
    modality?: string;
  };
}

export async function fetchOpenRouterModels(apiKey: string): Promise<LLMModel[]> {
  if (!apiKey) throw new Error("OpenRouter API key not configured");

  const res = await requestUrl({
    url: "https://openrouter.ai/api/v1/models",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (res.status >= 400) {
    throw new Error(`OpenRouter HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }

  const data = res.json;
  const models: OpenRouterModel[] = data.data || [];

  return models
    .filter((m) => !m.id.includes(":free"))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
    .map((m) => ({
      modelId: m.id,
      label: m.name || m.id,
      description: buildDescription(m),
    }));
}

function buildDescription(m: OpenRouterModel): string {
  const parts: string[] = [];

  if (m.context_length) {
    const ctx = m.context_length;
    if (ctx >= 1_000_000) parts.push(`${Math.round(ctx / 1_000_000)}M ctx`);
    else if (ctx >= 1000) parts.push(`${Math.round(ctx / 1000)}K ctx`);
    else parts.push(`${ctx} ctx`);
  }

  if (m.architecture?.modality && m.architecture.modality !== "text->text") {
    parts.push(m.architecture.modality);
  }

  if (m.pricing?.prompt) {
    const inputCost = parseFloat(m.pricing.prompt) * 1_000_000;
    if (inputCost < 0.1) parts.push("Ultra cheap");
    else if (inputCost < 1) parts.push("Cheap");
  }

  return parts.join(". ") || "OpenRouter model";
}

export function mergeOpenRouterModels(
  curated: LLMModel[],
  fetched: LLMModel[]
): LLMModel[] {
  const curatedIds = new Set(curated.map((m) => m.modelId));
  const merged = [...curated];

  for (const model of fetched) {
    if (!curatedIds.has(model.modelId)) {
      merged.push(model);
    }
  }

  return merged;
}
