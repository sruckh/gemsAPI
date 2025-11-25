# Phase 1 Implementation Checklist (Single-Container, Secure)

Use this checklist while implementing Phase 1. Everything installs **inside the container**, not on the host.

## Container & Networking
- [ ] Create `.dockerignore` to exclude `node_modules`, `.env`, etc.
- [ ] Dockerfile builds frontend then runs FastAPI; all npm/pip installs occur during image build.
- [ ] **Verify**: Frontend build does *not* receive sensitive `VITE_` env vars (prevents baking secrets).
- [ ] Container runs as non-root; `WORKDIR /app`.
- [ ] Internal port (e.g., 8000) is `EXPOSE`d but **not** mapped to host.
- [ ] Service attached to Docker network `shared_net`; reachable by Nginx Proxy Manager (NPM).
- [ ] Uvicorn started with `--proxy-headers` and `forwarded_allow_ips` configured to trust NPM.

## Secrets & Environment
- [ ] `.env.example` documents required vars: `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` (Service Role), `PORT`, `NODE_ENV`.
- [ ] Real `.env` is **not** committed; mounted/passed at runtime only.
- [ ] Frontend bundle does **not** embed Supabase or Gemini keys (verify built JS).
- [ ] No secrets in logs or error responses.

## FastAPI Server
- [ ] Implements `/api/gems` CRUD using server-side Supabase client (service key from env).
- [ ] Implements `/api/gemini/generate` calling Google AI with server-held key.
- [ ] Implements Rate Limiting on `/api/gemini/generate`.
- [ ] Serves React `dist/` via `StaticFiles`; root falls back to `index.html`.
- [ ] Adds `/healthz` (returns 200 OK) for NPM/ops checks.
- [ ] Input validation via Pydantic; consistent error shape; avoid stack traces to clients.
- [ ] CORS restricted to allowed origins (NPM-hosted domain, optional localhost for dev).
- [ ] Docs (Swagger UI) disabled or protected in production environment.
- [ ] Sensible timeouts and minimal logging; structured logs without secrets.

## Supabase
- [ ] `docs/supabase/gems_table.sql` executed in Supabase; `supabase_schema.sql` (corrupted) ignored/removed.
- [ ] RLS enabled on `public.gems`; service-role policy created; anon has no table access.
- [ ] Backend uses **service key**; frontend never receives Supabase keys.
- [ ] **Data Migration**: Decide if existing data needs manual export/import.

## Frontend
- [ ] `services/dbService.ts` refactored to call backend endpoints; no direct Supabase/Gemini client usage in browser.
- [ ] Config UI no longer stores API keys in localStorage; only non-secret prefs remain (e.g., theme).
- [ ] API base paths are relative (`/api/...`) to work behind NPM.
- [ ] Remove any `import.meta.env.VITE_*` references for sensitive keys.

## Testing & Verification
- [ ] Build image: `docker build -t gemsapi:phase1 .` (installs deps inside image only).
- [ ] Run container on `shared_net` with `--env-file .env`; confirm no host ports published.
- [ ] From within network/another container, curl `http://gemsapi:8000/healthz` and `/api/gems`.
- [ ] Through NPM, verify static site loads and Gem CRUD/Chat work; ensure browser dev tools show no secrets.
- [ ] Inspect built JS for absence of Supabase/Gemini keys.
- [ ] Review logs for leaked secrets; ensure error responses are sanitized.

## Documentation
- [ ] Keep `docs/phase1-dockerization.md` updated if implementation deviates.
- [ ] Note any assumptions or open risks for next phases.