# Phase 1 – Single-Container Dockerization (behind Nginx Proxy Manager)

## Objectives
- Run the entire app in **one container** (FastAPI backend + built React frontend + Supabase/Google AI clients).
- Expose services **only to Docker network `shared_net`**; **no host-port exposure**.
- Keep all dependencies installed **inside the container**; host remains clean.
- Prevent **API keys/secrets from reaching the browser**; ensure all calls to Google AI and Supabase originate server-side.
- Provide a SQL script usable in Supabase Dashboard to create the required `gems` table.

## High-Level Architecture
- **Container**: FastAPI app serves REST endpoints and static frontend (Vite build). It owns all external calls (Google AI, Supabase).
- **Network**: Container attached to `shared_net`; no `ports:` published. Nginx Proxy Manager (NPM) connects via `shared_net` and publishes HTTPS to users.
- **Config/Secrets**: `.env` file mounted or injected at runtime (never committed). Env vars loaded by FastAPI and used server-side only.
- **Data Flow**:
  1) Browser requests hit NPM → forwarded to container HTTP port (internal, e.g., 8000) on `shared_net`.
  2) FastAPI serves static React build and API routes.
  3) API routes call Google AI SDK and Supabase using server-held credentials.
  4) Responses return to browser without revealing secrets.

## Deliverables (files to add/update)
- `Dockerfile` (multi-stage build) that:
  - **Stage 1 (Builder)**: Uses Node to build frontend. *Crucial*: Ensure no sensitive `VITE_*` env vars are present during build to prevent baking secrets into the bundle.
  - **Stage 2 (Runner)**: Uses Python slim to run FastAPI + serve static files (copy `dist/` from Builder).
  - Installs Node/Python deps **inside** the image only.
  - Exposes internal port 8000 (no host publish; NPM will target it).
  - Includes a non-root user and minimal footprint.
- `.dockerignore`: Explicitly exclude `node_modules`, `__pycache__`, `.env`, `.git`, and other local artifacts to ensure a clean build context.
- `docker-compose.yml` (optional but recommended) demonstrating:
  - Service `gemsapi` attached to `shared_net`.
  - No `ports` section; only `expose: ["8000"]` for clarity.
  - `env_file: .env` and a volume for the built assets if needed.
  - Note: NPM defined elsewhere, also on `shared_net`, targets `gemsapi:8000`.
- `.env.example` documenting required variables:
  - `GEMINI_API_KEY`, `GEMINI_MODEL` (e.g. `gemini-3-pro-preview`), `SUPABASE_URL`, `SUPABASE_KEY` (Service Role), `PORT=8000`, `NODE_ENV=production`.
- `docs/supabase/gems_table.sql`: The canonical DDL for `gems` table and RLS policies.
- Backend updates:
  - Implement FastAPI routes that proxy Gemini and Supabase actions; move existing client-side Supabase/Gemini calls to backend.
  - Serve built `dist/` via FastAPI `StaticFiles`.
  - Ensure CORS configured for NPM host domain only.
  - Implement **Rate Limiting** (e.g., using `slowapi`) to prevent abuse of the generation endpoint.
  - **New**: Implement `POST /api/gems/execute` for API-driven Gem execution by name.
- Frontend updates:
  - Replace direct Supabase/Gemini calls with fetches to backend endpoints (no keys in client).
  - Build-time uses relative API base (`/api/...`) to work behind NPM.
  - **Cleanup**: Remove any code referencing `import.meta.env.VITE_SUPABASE_*` to prevent build errors or confusion.

## Key Constraints & Rules
- **No host installs**: All npm/pip installs happen inside Docker build. Local machine should stay untouched.
- **Secrets never in client**: API keys only loaded in FastAPI process; frontend receives only proxied results.
- **Network isolation**: Only `shared_net` connectivity; no `ports` mapping to host.
- **Reproducibility**: Container image build should succeed from repo + `.env` only.

## Implementation Steps
1) **Create .dockerignore**
   - Exclude: `node_modules`, `dist`, `build`, `*.pyc`, `__pycache__`, `.env`, `.git`, `.DS_Store`, `.serena`.
2) **Create Dockerfile**
   - Stage 1 (builder): `node:20-alpine`, install npm deps, run `npm run build`.
   - Stage 2 (runner): `python:3.12-slim`, install `fastapi`, `uvicorn`, `google-genai`, `supabase`, `python-dotenv`, `aiofiles`, `slowapi`, etc. Copy `dist/` and backend code. Set `PORT=8000`, `UVICORN_CMD`.
   - Add non-root user, set `WORKDIR /app`, `EXPOSE 8000` (for documentation only).
3) **FastAPI app build-out**
   - Implement API routes: `/api/gems` CRUD, `/api/gemini/generate` (free-form), and `/api/gems/execute` (named gem execution).
   - **Security**: Load env vars securely; disable any echoing of secrets in logs.
   - **Resilience**: Implement a `/healthz` endpoint (returns 200 OK) for container orchestration/NPM checks.
   - Mount `dist/` as static, default route serves `index.html`.
4) **Frontend API refactor**
   - Update services to call backend endpoints instead of using `@supabase/supabase-js` or Google client in-browser.
   - Remove client-side storage of Supabase keys; keep config UI but direct it to backend-managed connections (or remove if redundant).
   - Preserve localStorage for non-secret prefs (theme).
5) **Supabase schema & Migration**
   - Run `docs/supabase/gems_table.sql` in Supabase Dashboard.
   - **Decision Point**: If migrating existing data, export from old project and import to new Supabase project manually. This plan assumes a fresh start or manual data migration.
6) **docker-compose (optional)**
   - Service definition with `env_file: .env`, `expose: ["8000"]`, `networks: [shared_net]`.
   - Note: NPM stack already exists; add `external: true` network `shared_net`.
7) **Testing plan**
   - Build image locally: `docker build -t gemsapi:phase1 .` (inside CI or allowed build host).
   - Run container attached to `shared_net`.
   - Hit via curl inside network or through NPM to verify static + API routes.
8) **Security checks**
   - Confirm no `console.log` or responses leak secrets.
   - Verify network exposure: `docker inspect` shows no host ports.
   - Validate CORS allowed origins (NPM-hosted domain).

## Validation Criteria (Definition of Done)
- Repo contains Dockerfile, .dockerignore, .env.example, updated schema SQL, and backend/frontend code paths ready for build.
- Building image installs all deps inside container; host remains untouched.
- Container runs on `shared_net` with only internal exposure; reachable from NPM.
- Frontend functions (Gem CRUD, chat) through backend proxies; secrets never appear in browser dev tools.
- Supabase table creation succeeds via provided SQL; app operates against it.
