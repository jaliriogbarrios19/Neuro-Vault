import { App, requestUrl } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

registerTool(
  {
    name: "web_search",
    description: "Search the web using the configured provider (Brave, Tavily, or SearXNG)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  async (_app, args) => {
    const query = String(args.query ?? "");
    if (!query) return JSON.stringify({ error: "Missing query" });

    const plugin = getPluginInstance();
    if (!plugin) return JSON.stringify({ error: "Plugin not initialized." });

    const provider = plugin.settings.webSearchProvider;
    try {
      let results: SearchResult[] = [];
      if (provider === "tavily") results = await searchTavily(query, plugin.settings.tavilyApiKey);
      else if (provider === "searxng") results = await searchSearXNG(query, plugin.settings.searxngUrl);
      else results = await searchBrave(query, plugin.settings.braveApiKey);

      if (results.length === 0) {
        return JSON.stringify({ results: [], message: "No results found." });
      }
      return JSON.stringify({ results });
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  }
);

async function searchBrave(query: string, apiKey: string): Promise<SearchResult[]> {
  if (!apiKey) {
    throw new Error("Brave Search API key not configured. Settings → Neuro Vault → Web Search.");
  }
  const params = new URLSearchParams({ q: query, count: "10" });
  const res = await requestUrl({
    url: `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });
  if (res.status >= 400) {
    throw new Error(`Brave HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  return (res.json.web?.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.description ?? "",
  }));
}

async function searchTavily(query: string, apiKey: string): Promise<SearchResult[]> {
  if (!apiKey) {
    throw new Error("Tavily API key not configured. Settings → Neuro Vault → Web Search.");
  }
  const res = await requestUrl({
    url: "https://api.tavily.com/search",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, api_key: apiKey, search_depth: "basic", max_results: 10 }),
  });
  if (res.status >= 400) {
    throw new Error(`Tavily HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  return (res.json.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.content ?? r.description ?? "",
  }));
}

async function searchSearXNG(query: string, baseUrl: string): Promise<SearchResult[]> {
  if (!baseUrl) {
    throw new Error("SearXNG URL not configured. Settings → Neuro Vault → Web Search.");
  }
  const url = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({ q: query, format: "json" });
  const res = await requestUrl({ url: `${url}/search?${params.toString()}` });
  if (res.status >= 400) {
    throw new Error(`SearXNG HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  return (res.json.results ?? []).map((r: any) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    description: r.content ?? r.snippet ?? "",
  }));
}
