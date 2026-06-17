import { requestUrl } from "obsidian";
import { AcademicWork } from "../types";

const OPENALEX_BASE = "https://api.openalex.org/works";

export async function fetchOpenAlex(
  query: string,
  email: string
): Promise<AcademicWork[]> {
  const params = new URLSearchParams({ search: query });
  if (email) params.set("mailto", email);
  const res = await requestUrl(`${OPENALEX_BASE}?${params.toString()}`);
  if (res.status >= 400) return [];

  const data = res.json;
  const results: AcademicWork[] = [];
  const detailIds: number[] = [];

  for (const w of (data.results ?? [])) {
    const openalexId: string = w.id ?? "";
    const idMatch = openalexId.match(/[Ww](\d+)$/);
    const numericId = idMatch ? parseInt(idMatch[1], 10) : 0;
    if (numericId && detailIds.length < 5) detailIds.push(numericId);

    results.push({
      doi: w.doi ?? "",
      title: w.title ?? w.display_name ?? "",
      authors:
        w.authorships?.map((a: any) => ({
          name: a.author?.display_name ?? "",
        })) ?? [],
      year: w.publication_year ?? 0,
      journal: w.host_venue?.display_name ?? "",
      abstract_text: "",
      relevance_score: w.relevance_score ?? 0.5,
      url: w.doi ?? "",
    });
  }

  if (detailIds.length > 0) {
    const abstracts = await fetchAbstracts(detailIds, email);
    for (let i = 0; i < results.length && i < detailIds.length; i++) {
      results[i].abstract_text = abstracts.get(detailIds[i]) ?? "";
    }
  }

  return results;
}

async function fetchAbstracts(
  ids: number[],
  email: string
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  try {
    const mailtoParam = email ? `mailto=${email}` : "";
    const promises = ids.map(async (id) => {
      try {
        const url = mailtoParam
          ? `${OPENALEX_BASE}/${id}?${mailtoParam}`
          : `${OPENALEX_BASE}/${id}`;
        const res = await requestUrl(url);
        if (res.status >= 400) return { id, abstract: "" };
        const work = res.json;
        const inverted = (work as any).abstract_inverted_index;
        const abstract =
          inverted && typeof inverted === "object"
            ? reconstructAbstract(inverted)
            : "";
        return { id, abstract };
      } catch {
        return { id, abstract: "" };
      }
    });
    const results = await Promise.all(promises);
    for (const { id, abstract } of results) {
      if (abstract) result.set(id, abstract);
    }
  } catch {
    // non-fatal
  }
  return result;
}

function reconstructAbstract(
  inverted: Record<string, number[]>
): string {
  const wordPositions: [string, number][] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const pos of positions) {
      wordPositions.push([word, pos]);
    }
  }
  wordPositions.sort((a, b) => a[1] - b[1]);
  return wordPositions.map(([word]) => word).join(" ");
}
