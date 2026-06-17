# Summary: Web Research

## Completed
- **2 tools agregados**: `web_search` (Brave Search) y `academic_search` (PubMed + OpenAlex agentic pipeline)
- **4 archivos nuevos**: web-search.ts (69L), academic-search.ts (~240L), pubmed-api.ts (~130L), openalex-api.ts (~85L)
- **4 archivos modificados**: llm-client.ts (+callLLM), settings.ts (+plugin instance, +3 tool keys), types.ts (+AcademicWork, +3 fields), main.ts (+imports)
- **3 rondas Judgment Day**: 6 CRITICALs + 9 WARNINGs resueltos. Veredicto: APPROVED.
- **Build**: tsc + esbuild pasan sin errores.
- **Líneas**: todos los archivos ≤300 (máx llm-client.ts ~285L).

## Key Fixes (Judgment Day)
- PubMed XML parsing: regex → DOMParser (evita misattribution de abstracts)
- Dedup: seen.set() + DOI normalization con regex canónico
- Reranking: scores del LLM se preservan en seen (no se descartan)
- OpenAlex: abstracts fetcheados vía work detail endpoint (Promise.all)
- PubMed: fetchWithRetry con exponential backoff en 429 + 5xx
- Robustez: Promise.allSettled para no perder OpenAlex si PubMed falla
- Seguridad: email fake removido, requestUrl en vez de fetch para Brave

## Architecture Patterns Established
- `getPluginInstance()/setPluginInstance()` para tools que necesitan settings
- `callLLM()` en llm-client.ts para llamadas no-streaming desde tools
- `addToggleBtn()` helper en SettingsTab para evitar duplicación
- `fetchWithRetry()` para APIs con rate limiting

## Remaining (pre-existing, out of scope)
- Gemini streaming roto en streamChat
- Model IDs ficticios en types.ts
- Sin test runner automatizado
- Settings guardan en cada keystroke (sin debounce)

## Next Steps
- Manual smoke test en Obsidian
- Agregar vitest para tests unitarios
- Corregir model IDs a valores reales
- Arreglar Gemini streaming
