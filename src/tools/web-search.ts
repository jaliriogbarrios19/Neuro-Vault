import { App, requestUrl } from "obsidian";
import { registerTool } from "../tool-registry";
import { getPluginInstance } from "../settings";

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

interface FetchResult {
  url: string;
  status: number;
  content: string;
  error?: string;
}

registerTool(
  {
    name: "web_search",
    description: "Search the web using the configured provider (Brave, Tavily, SearXNG, or DuckDuckGo). Can also fetch full content from specific URLs.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        urls: { type: "array", description: "Optional URLs to fetch full content from" },
      },
      required: [],
    },
  },
  async (_app, args) => {
    const query = String(args.query ?? "");
    const urls = (args.urls as string[] | undefined) ?? [];

    const plugin = getPluginInstance();
    if (!plugin) return JSON.stringify({ error: "Plugin not initialized." });

    // If URLs provided, fetch them directly
    if (urls.length > 0) {
      const results = await fetchUrls(urls);
      return JSON.stringify({ results });
    }

    if (!query) return JSON.stringify({ error: "Missing query" });

    const provider = plugin.settings.webSearchProvider;
    try {
      let results: SearchResult[] = [];
      if (provider === "tavily") results = await searchTavily(query, plugin.settings.tavilyApiKey);
      else if (provider === "searxng") results = await searchSearXNG(query, plugin.settings.searxngUrl);
      else if (provider === "duckduckgo") results = await searchDuckDuckGo(query);
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

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query, format: "json", no_html: "1", no_redirect: "1" });
  const res = await requestUrl({ url: `https://html.duckduckgo.com/html/?${params.toString()}` });
  if (res.status >= 400) {
    throw new Error(`DuckDuckGo HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  }
  // Parse HTML results (DuckDuckGo HTML endpoint)
  const html = res.text;
  const results: SearchResult[] = [];

  const titleMatches = html.match(/class="result__title"[^>]*>([^<]+)</g) ?? [];
  const urlMatches = html.match(/class="result__url"[^>]*>([^<]+)</g) ?? [];
  const snippetMatches = html.match(/class="result__snippet"[^>]*>([^<]+)</g) ?? [];

  const count = Math.min(titleMatches.length, urlMatches.length, snippetMatches.length, 10);
  for (let i = 0; i < count; i++) {
    results.push({
      title: titleMatches[i].replace(/.*?>([^<]+)</, "$1"),
      url: urlMatches[i].replace(/.*?>([^<]+)</, "$1"),
      description: snippetMatches[i].replace(/.*?>([^<]+)</, "$1"),
    });
  }
  return results;
}

async function fetchUrls(urlList: string[]): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  for (const url of urlList) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      results.push({ url, status: 0, content: "", error: "Invalid URL" });
      continue;
    }
    try {
      const res = await requestUrl({
        url,
        headers: { "User-Agent": "NeuroVault/1.0" },
      });
      if (res.status >= 400) {
        results.push({ url, status: res.status, content: "", error: `HTTP ${res.status}` });
      } else {
        const text = res.text;
        // Strip HTML tags
        const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        results.push({ url, status: res.status, content: stripped.slice(0, 5000) });
      }
    } catch (e) {
      results.push({ url, status: 0, content: "", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}
