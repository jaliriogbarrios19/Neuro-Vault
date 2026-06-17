# Tasks: Web Research

## Review Workload Forecast
- Estimated: ~320 lines
- 400-line budget risk: Low
- Chained PRs: No
- Single PR

## Phase 1: API Clients
- [x] 1.1 `src/tools/pubmed-api.ts` — PubMed E-utilities con DOMParser + fetchWithRetry (429/5xx)
- [x] 1.2 `src/tools/openalex-api.ts` — OpenAlex search + abstracts vía work detail (Promise.all)

## Phase 2: Tools
- [x] 2.1 `src/tools/web-search.ts` — Brave Search vía requestUrl
- [x] 2.2 `src/tools/academic-search.ts` — Pipeline agentic completo

## Phase 3: Settings + Wiring
- [x] 3.1 `src/types.ts` — +AcademicWork, +braveApiKey, +pubmedApiKey, +crossrefEmail
- [x] 3.2 `src/settings.ts` — +setPluginInstance/getPluginInstance, +3 tool keys UI, +addToggleBtn
- [x] 3.3 `main.ts` — +2 tool imports, +setPluginInstance(), fix PluginSettings import

## Phase 4: Fixes (Judgment Day)
- [x] 4.1 R1: PubMed regex → DOMParser, dedupWorks seen.set(), OpenAlex abstracts, DOI normalization, max_tokens 8192, PubMed retry
- [x] 4.2 R2: Reranked scores preservation, Promise.all parallel, 5xx retry, Promise.allSettled, fake email removed
- [x] 4.3 R3: Approved — zero CRITICALs remaining

## Phase 5: Verify
- [x] `tsc -noEmit -skipLibCheck` ✅
- [x] All files ≤300 líneas ✅
- [x] Judgment Day: APPROVED
