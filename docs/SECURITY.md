# Security Hygiene

- **Never expose service-role secrets to the frontend.** Only `VITE_*` keys may be shipped to the browser; `SUPABASE_KEY` and `API_TOKEN` must remain server-side.
- **Startup guard:** the API fails to boot if the service key matches the anon key, if `VITE_SUPABASE_KEY` is set, or if built assets contain secret bytes.
- **Pre-push check:** run `npm run secret:check` (wraps `scripts/check_secrets.sh`) to scan `dist`, `public`, `src`, and docs for markers like `SUPABASE_KEY`, `service_role`, or `API_TOKEN`.
- **Logging:** do not add logs that print request headers, bearer tokens, or environment variables.
- **Rotation:** rotate keys immediately if a secret is ever printed or committed; update `.env` accordingly.
- **Docker build args:** when building, ensure `VITE_SUPABASE_ANON_KEY` build arg uses the anon key (`${VITE_SUPABASE_ANON_KEY}`), not the service role key, so the frontend bundle never bakes the service key.
