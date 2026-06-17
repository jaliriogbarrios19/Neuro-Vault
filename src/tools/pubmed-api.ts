import { requestUrl } from "obsidian";
import { AcademicWork } from "../types";

const PUBMED_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export async function fetchPubMed(
  query: string,
  apiKey: string
): Promise<AcademicWork[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: "10",
  });
  if (apiKey) params.set("api_key", apiKey);

  const searchRes = await requestUrlWithRetry(
    `${PUBMED_BASE}/esearch.fcgi?${params.toString()}`
  );
  if (searchRes.status >= 400) return [];
  const searchData = searchRes.json;
  const ids: string[] = searchData.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  const summaryParams = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
  });
  if (apiKey) summaryParams.set("api_key", apiKey);

  const sumRes = await requestUrlWithRetry(
    `${PUBMED_BASE}/esummary.fcgi?${summaryParams.toString()}`
  );
  if (sumRes.status >= 400) return [];
  const sumData = sumRes.json;

  const abstracts = await fetchAbstracts(ids, apiKey);

  const works: AcademicWork[] = [];
  for (const id of ids) {
    const article = sumData.result?.[id];
    if (!article) continue;
    const doi =
      article.articleids?.find((a: { idtype: string }) => a.idtype === "doi")
        ?.value ?? "";
    works.push({
      doi: doi ? `https://doi.org/${doi}` : "",
      title: article.title ?? "",
      authors:
        article.authors?.map((a: { name: string }) => ({ name: a.name })) ??
        [],
      year: parseInt(article.pubdate?.split(" ")[0] ?? "0") || 0,
      journal: article.fulljournalname ?? "",
      abstract_text: abstracts.get(id) ?? "",
      relevance_score: 0.9,
      url: doi
        ? `https://doi.org/${doi}`
        : `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    });
  }
  return works;
}

async function fetchAbstracts(
  ids: string[],
  apiKey: string
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const params = new URLSearchParams({
      db: "pubmed",
      id: ids.join(","),
      retmode: "xml",
      rettype: "abstract",
    });
    if (apiKey) params.set("api_key", apiKey);

    const res = await requestUrlWithRetry(
      `${PUBMED_BASE}/efetch.fcgi?${params.toString()}`
    );
    if (res.status >= 400) return result;

    const parser = new DOMParser();
    const doc = parser.parseFromString(res.text, "text/xml");
    const articles = doc.querySelectorAll("PubmedArticle");

    for (const article of articles) {
      const pmidEl = article.querySelector("PMID");
      if (!pmidEl) continue;
      const pmid = pmidEl.textContent?.trim() ?? "";
      if (!pmid) continue;

      const abstractParts: string[] = [];
      const abstractTextEls = article.querySelectorAll("AbstractText");
      for (const el of abstractTextEls) {
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (text) abstractParts.push(text);
      }
      const abstract = abstractParts.join(" ");
      if (abstract) result.set(pmid, abstract);
    }
  } catch {
    // non-fatal
  }
  return result;
}

async function requestUrlWithRetry(
  url: string,
  maxRetries = 3
): Promise<{ status: number; json: any; text: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await requestUrl({ url });
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => window.setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((r) => window.setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
