# Spec: Web Research

## web-search

### Requirement: Web Search Tool
El sistema MUST exponer `web_search` que busque en internet vía Brave Search API.

#### Scenarios
- GIVEN `braveApiKey` configurada, WHEN `web_search({ query })`, THEN retorna JSON con resultados (title, url, description), max 10.
- GIVEN sin `braveApiKey`, THEN retorna error: "Brave Search API key not configured."
- GIVEN API error HTTP, THEN retorna JSON `{ error: "Brave Search HTTP {status}" }`.
- GIVEN query sin resultados, THEN retorna array vacío con mensaje informativo.

## academic-search

### Requirement: Academic Search Tool
El sistema MUST exponer `academic_search` con pipeline agentic: optimize query → search (PubMed ∥ OpenAlex) → rerank → coverage eval → iterate (max 3).

#### Scenarios
- GIVEN LLM provider configurado, WHEN búsqueda, THEN optimiza query, busca en ambas APIs, rerankea, evalúa cobertura, itera si <3 papers con score ≥0.7.
- GIVEN sin LLM provider, THEN retorna error: "LLM provider not configured."
- GIVEN sin `pubmedApiKey`, THEN PubMed funciona con rate limit reducido.
- GIVEN búsqueda sin resultados, THEN retorna array vacío sin iterar.
- GIVEN PubMed falla (5xx agotado), THEN OpenAlex results se preservan (Promise.allSettled).

### Requirement: PubMed API Client
`fetchPubMed(query, apiKey?)` — E-utilities: esearch → esummary → efetch con DOMParser + retry en 429/5xx.

### Requirement: OpenAlex API Client
`fetchOpenAlex(query, email?)` — api.openalex.org/works + fetch abstracts vía work detail endpoint con Promise.all paralelo.

## Non-functional
- Todos los archivos fuente ≤300 líneas.
- `tsc -noEmit -skipLibCheck` pasa sin errores.
- API keys en settings con toggle show/hide.
