import { App } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";
import { fetchPubMed } from "./pubmed-api";
import { fetchOpenAlex } from "./openalex-api";
import { callLLM } from "../llm-client";
import type { AcademicWork, LLMProvider } from "../types";

registerTool(
  {
    name: "academic_search",
    description:
      "Search academic papers across PubMed and OpenAlex with iterative refinement",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Research question or keywords",
        },
      },
      required: ["query"],
    },
  },
  async (_app, args) => {
    const query = String(args.query ?? "");
    if (!query) return JSON.stringify({ error: "Missing query" });

    const plugin = getPluginInstance();
    if (!plugin) {
      return JSON.stringify({
        error: "Plugin not initialized. Try reopening Neuro Vault.",
      });
    }

    const settings = plugin.settings;
    const provider = settings.llmProvider;
    const apiKey = plugin.getApiKey(provider);
    if (!apiKey) {
      return JSON.stringify({
        error:
          "LLM provider not configured. Set an API key in Settings → Neuro Vault.",
      });
    }
    const model = plugin.getModel(provider);

    try {
      const variants = await optimizeQuery(provider, apiKey, model, query);
      const seen = new Map<string, AcademicWork>();
      let currentQuery = variants[0];
      const maxIterations = Math.min(3, variants.length);

      for (let i = 0; i < maxIterations; i++) {
        const [pubmedResult, openalexResult] = await Promise.allSettled([
          fetchPubMed(currentQuery, settings.pubmedApiKey),
          fetchOpenAlex(currentQuery, settings.crossrefEmail || ""),
        ]);
        const pubmed = pubmedResult.status === "fulfilled" ? pubmedResult.value : [];
        const openalex = openalexResult.status === "fulfilled" ? openalexResult.value : [];

        const combined = [...pubmed, ...openalex];
        const deduped = dedupWorks(combined, seen);

        if (deduped.length === 0) break;

        const reranked = await rerankResults(
          provider,
          apiKey,
          model,
          query,
          deduped
        );

        for (const w of reranked) {
          const key = dedupKey(w);
          const existing = seen.get(key);
          if (existing) {
            existing.relevance_score = w.relevance_score;
          } else {
            seen.set(key, w);
          }
        }

        const coverage = await evaluateCoverage(
          provider,
          apiKey,
          model,
          query,
          reranked
        );

        if (coverage.sufficient) break;
        currentQuery = coverage.refinedQuery || variants[i + 1] || variants[0];
      }

      const merged = Array.from(seen.values());
      merged.sort((a, b) => b.relevance_score - a.relevance_score);

      return JSON.stringify({
        results: merged.map((w) => ({
          title: w.title,
          authors: w.authors.map((a) => a.name).join(", "),
          year: w.year,
          journal: w.journal,
          abstract: w.abstract_text || "No abstract available",
          doi: w.doi,
          url: w.url,
          relevance: w.relevance_score,
        })),
      });
    } catch (e) {
      return JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
);

function dedupKey(w: AcademicWork): string {
  const doiMatch = w.doi?.match(
    /(?:doi\.org\/|dx\.doi\.org\/)?(10\.\d{4,}\/[^\s"'<>]+)/i
  );
  if (doiMatch) return doiMatch[1].toLowerCase();
  return w.title.toLowerCase();
}

function dedupWorks(
  works: AcademicWork[],
  seen: Map<string, AcademicWork>
): AcademicWork[] {
  const result: AcademicWork[] = [];
  for (const w of works) {
    const key = dedupKey(w);
    if (!seen.has(key)) {
      seen.set(key, w);
      result.push(w);
    }
  }
  return result;
}

async function optimizeQuery(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  naturalQuery: string
): Promise<string[]> {
  const prompt = `Convert this research question into 5 optimized keyword search variants for academic databases (PubMed, OpenAlex). Return ONLY a JSON array of strings, no markdown: ["variant1", "variant2", ...]. Question: ${naturalQuery}`;

  try {
    const raw = await callLLM(provider, apiKey, model, prompt);
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    if (Array.isArray(parsed?.variants)) return parsed.variants;
    return [naturalQuery];
  } catch {
    return [naturalQuery];
  }
}

async function rerankResults(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  question: string,
  works: AcademicWork[]
): Promise<AcademicWork[]> {
  if (works.length === 0) return works;

  const papers = works
    .map(
      (w, i) =>
        `${i}: ${w.title} (${w.year})\n   Abstract: ${(w.abstract_text || "N/A").slice(0, 300)}`
    )
    .join("\n\n");

  const prompt = `Rate how relevant each paper is to: "${question}". Score 0.0-1.0. Return ONLY JSON array: [{"index": 0, "score": 0.85}, ...]. Papers:\n${papers}`;

  try {
    const raw = await callLLM(provider, apiKey, model, prompt);
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const scores: { index: number; score: number }[] = JSON.parse(cleaned);
    const scoreMap = new Map<number, number>();
    for (const s of scores) {
      if (typeof s.index === "number" && typeof s.score === "number") {
        scoreMap.set(s.index, s.score);
      }
    }
    return works.map((w, i) => ({
      ...w,
      relevance_score: scoreMap.get(i) ?? w.relevance_score,
    }));
  } catch {
    return works;
  }
}

async function evaluateCoverage(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  question: string,
  works: AcademicWork[]
): Promise<{ sufficient: boolean; refinedQuery: string }> {
  const highRelevance = works.filter((w) => w.relevance_score >= 0.7);
  if (highRelevance.length >= 3) {
    return { sufficient: true, refinedQuery: "" };
  }

  if (works.length === 0) {
    return { sufficient: true, refinedQuery: "" };
  }

  const summaries = works
    .map((w, i) => `${w.title} (${w.year}) — score ${w.relevance_score.toFixed(2)}`)
    .join("\n");

  const prompt = `Search for "${question}" found these papers but coverage may be insufficient. Return ONLY JSON: {"refinedQuery": "new search keywords"}. Papers:\n${summaries}`;

  try {
    const raw = await callLLM(provider, apiKey, model, prompt);
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      sufficient: false,
      refinedQuery: parsed.refinedQuery || question,
    };
  } catch {
    return { sufficient: false, refinedQuery: "" };
  }
}
