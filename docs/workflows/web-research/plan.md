# Plan: Web Research

## Technical Approach
Dos tools nuevos vía `registerTool()`: `web_search` (Brave Search API directa) y `academic_search` (PubMed + OpenAlex con pipeline agentic). API keys en `PluginSettings`. Tools acceden al plugin vía `getPluginInstance()`.

## Architecture Decisions

| Decisión | Choice | Rationale |
|----------|--------|-----------|
| Web search API | Brave Search | Gratis 2k/mes, REST, calidad Google |
| Academic search | PubMed + OpenAlex | Código probado en Research_and_Paper, APIs gratuitas |
| Tool registration | Auto-registro side-effect import | Mismo patrón que echo/vault-ops |
| Plugin access | Module-level getter/setter | Mismo patrón que spobBaseUrl |
| PubMed key | Opcional | Sin key = 3 req/sec suficiente |
| OpenAlex email | Opcional, solo si configurado | OpenAlex funciona sin mailto |
| PubMed XML parsing | DOMParser | Sustituye regex frágil |
| PubMed retry | Exponential backoff en 429 + 5xx | fetchWithRetry |
| OpenAlex abstracts | Work detail endpoint, Promise.all | Paralelo, hasta 5 |
| LLM non-streaming | callLLM exportado de llm-client | OpenAI-compat + Anthropic + Gemini |

## Data Flow
```
User → ChatEngine.agentLoop() → LLM decides tool
  → web_search: requestUrl → Brave API → JSON results
  → academic_search:
      callLLM (optimize query) → 5 variants
      loop (max 3):
        Promise.allSettled(fetchPubMed ∥ fetchOpenAlex)
        → dedupWorks → rerankResults (callLLM) → evaluateCoverage (callLLM)
        → sufficient? break : next variant
      → merged results JSON
```

## File Changes
| File | Action | Líneas |
|------|--------|--------|
| `src/tools/web-search.ts` | Create | 69 |
| `src/tools/academic-search.ts` | Create | ~240 |
| `src/tools/pubmed-api.ts` | Create | ~130 |
| `src/tools/openalex-api.ts` | Create | ~85 |
| `src/llm-client.ts` | Modify | +90 (callLLM + helpers) |
| `src/settings.ts` | Modify | +35 (plugin instance + tool keys UI) |
| `src/types.ts` | Modify | +10 (AcademicWork + 3 fields) |
| `main.ts` | Modify | +4 (imports + setPluginInstance) |

## Testing Strategy
- Type check: `tsc -noEmit -skipLibCheck` ✅
- Manual: cargar plugin en Obsidian, configurar keys, probar búsquedas.
- Sin test runner automatizado.
