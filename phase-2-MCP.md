# Phase 2: LLM Client Integration (MCP & Stable Access)

## Goal
Let external LLM clients reliably consume stored Gems (system instructions) with minimal new surface area, strong auth, and predictable contracts. Preserve existing API/front-end while adding an LLM-friendly access path.

## Options Reviewed
- **Model Context Protocol (MCP) server**: Standard, client-side SDKs emerging (Anthropic Claude Desktop, VS Code/Cursor). Provides resource listing + tools + prompts. Pros: protocol-fit, keeps model vendor-agnostic, can stream instructions, supports auth headers. Cons: still evolving, requires new service process.  
- **Plain REST “prompt pack” endpoint**: New `/api/gems/{id|name}/package` returning instructions + metadata + safety labels + checksum. Pros: trivial to adopt, works with any HTTP-capable LLM runtime. Cons: lacks discoverability for MCP-aware clients; needs client glue.  
- **Per-model native wrappers (e.g., OpenAI Assistants, Vertex prompt files)**: Fast start but ties us to vendors, complicates governance.

**Recommendation:** Implement an MCP server façade backed by Supabase, and also expose a minimal REST prompt-package endpoint for non-MCP clients. This gives a stable core (REST) plus protocol-native ergonomics (MCP). Keep the FastAPI app as the single gateway.

## Target Architecture (Phase 2)
- **MCP server** runs inside the existing FastAPI container (uvicorn sidecar task or sub-app).  
- **Resources**  
  - `gems:list` -> list metadata (id, name, description, updated_at).  
  - `gems:get` -> fetch instructions + metadata by `id` or `name`.  
  - `gems:search` (optional) -> filter by text/tags once tags exist.  
- **Tools (optional)**  
  - `gems.execute` -> run a Gem through current `/api/gems/execute` path (reuses rate limiting).  
  - `gemini.generate` passthrough (keeps parity with current `/api/gemini/generate`).  
- **Auth (multi-user via Supabase)**  
  - Each user signs in via Supabase; MCP `args` include the Supabase access token once at registration.  
  - MCP handshake hits a small auth-check endpoint; on 200, all resources/tools are exposed.  
  - RLS on `gems.user_id` already guarantees: bearer token ↔ user_id ↔ gem ownership. No extra ACL tables.  
  - Single-user fallback: set `API_TOKEN`; all requests use that token, RLS still allowed but effectively one principal.  
- **Response shape stability**: include `schema_version`, `checksum` (SHA-256 of instructions), and `updated_at` to let clients cache/validate.  
- **Transport**: HTTP(s) over existing reverse proxy; no new ports.  
- **Back-compat**: keep existing `/api/gems` CRUD & execute unchanged.

## Work Plan
1) **MCP scaffolding**  
   - Add lightweight MCP server implementation (e.g., python `mcp` pkg) as a FastAPI sub-app or background task.  
   - Wire auth middleware to reuse `get_user_supabase_client`.  
   - Feature flag: `ENABLE_MCP` (default false in `.env.example`; set true on deployed instance).  
2) **Resource adapters**  
   - Implement `list` and `get` handlers that call Supabase via existing client.  
   - Attach `checksum`, `schema_version`, `updated_at`, `description`, `owner_user_id`.  
3) **Tool adapters** (optional but recommended)  
   - `gems.execute` tool delegates to existing execute endpoint to avoid duplicating model logic.  
   - Add guardrails: rate-limit + enforce model fallback behavior already in `generate_gemini_response`.  
4) **REST prompt-package endpoint**  
   - New `GET /api/gems/{id|name}/package` returning `{instructions, description, checksum, schema_version, updated_at}`.  
   - Same auth model; respects RLS.  
5) **Client docs & samples**  
   - Add `docs/MCP_CLIENTS.md` with examples for Claude Desktop + generic HTTP (curl).  
   - Expose `.well-known/mcp.json` manifest that points to the MCP server URL and notes `args.auth_token` usage.  
6) **Testing**  
   - Unit: MCP handlers (auth, RLS respect, checksum).  
   - Integration: happy-path list/get, execute via MCP, and REST package fetch.  
   - Load: confirm rate limits mirror existing endpoints.  
7) **Deployment**  
   - Extend Dockerfile to install MCP dependency; ensure no new port exposure.  
   - Update `README.md` with how to enable MCP mode (env flag, default on).  
8) **Telemetry & observability**  
   - Log MCP requests with user/email + gem_id (no instructions).  
   - Surface error metrics alongside FastAPI logs.

## Design Notes
- **Stability**: REST package endpoint is the compatibility baseline; MCP layers on top but can be disabled via env (`ENABLE_MCP=false`).  
- **Caching**: Encourage clients to cache by `checksum` and `updated_at`; supports offline/edge use.  
- **Security**: No anonymous access; RLS still enforced via Supabase session. API_TOKEN bypass remains for trusted automation or single-user mode.  
- **Extensibility**: If tags/versions are added later, expose `version` and `tags` in both MCP and REST payloads without breaking existing schema_version.  
- **Auth simplicity**: Multi-user path reuses Supabase Auth JWTs; no new token->user mapping table needed. Single-user path uses `API_TOKEN` and shared gems.

## Open Questions
- Do we need multi-tenant rate limits distinct from REST usage? (initial idea: reuse limiter; add modest cap for list/get to deter abuse).  
- Execute will be added after validating the read-only path.  
- Any need for user-to-user sharing later, or is strict isolation sufficient?
