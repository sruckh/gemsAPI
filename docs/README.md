# GemsAPI - Secure Gemini Gems Manager

This project allows you to manage and execute "Gems" (custom AI personas) using Google's Gemini API. It features a secure backend-for-frontend architecture, ensuring that API keys and sensitive logic are kept server-side.

## Key Features

- **Gem Manager**: Create, edit, and delete Gems (stored in Supabase).
- **Chat Interface**: Interact with your Gems using a modern chat UI.
- **API-First Execution**: Execute Gems programmatically via the `/api/gems/execute` endpoint.
- **Secure Architecture**: All AI and Database interactions happen on the backend. No keys in the browser.
- **Dockerized**: Ready for deployment behind Nginx Proxy Manager.

## Implementation Status

Phase 1 (Single-Container Dockerization) is **Complete**.

See `docs/phase1-implementation-log.md` for a detailed change log.

## API Reference

### `POST /api/gems/execute`

Executes a specific Gem by name.

**Request Body:**
```json
{
  "gem_name": "Python Expert",
  "user_prompt": "How do I use list comprehensions?",
  "model_name": "gemini-2.0-flash" // Optional
}
```

**Response:**
```json
{
  "text": "List comprehensions provide a concise way to create lists..."
}
```

### `POST /api/gemini/generate`

Free-form generation using the configured Gemini model.

**Request Body:**
```json
{
  "system_instructions": "You are a helpful assistant.",
  "user_prompt": "Hello!",
  "model_name": "gemini-2.0-flash" // Optional
}
```

## Deployment

1. Copy `.env.example` to `.env` and fill in your keys.
2. Run `docker compose up -d --build`.