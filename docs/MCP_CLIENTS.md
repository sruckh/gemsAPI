# GemsAPI MCP Client Integration Guide

GemsAPI exposes a standard remote MCP server over **streamable HTTP**. Any MCP client that takes a URL and a token works — Claude Desktop, Claude Code, Cursor, VS Code and others. No local script, no middleware, no `pip install`.

## Server

| Setting | Value |
|---------|-------|
| URL | `https://gemsapi.gemneye.info/mcp` |
| Transport | Streamable HTTP (stateless) |
| Auth | `Authorization: Bearer <token>` header on every request |
| Manifest | `/.well-known/mcp.json` |

Tokens accepted:
- The server's `API_TOKEN` (service access)
- Any valid **Supabase access token** — gems are then filtered per-user by RLS

## Claude Desktop / claude.ai

1. Open **Settings → Connectors → Add custom connector**
2. **Remote MCP server URL**: `https://gemsapi.gemneye.info/mcp`
3. Under **Authentication → Request headers**, add:
   - Name: `Authorization`
   - Value: `Bearer YOUR_TOKEN`
4. Save. The connector connects from Anthropic's cloud, so the server must be reachable over public HTTPS.

## Claude Code

```bash
claude mcp add --transport http gemsapi https://gemsapi.gemneye.info/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

## Cursor / other clients

Most clients read a `.mcp.json` (or equivalent config) like:

```json
{
  "mcpServers": {
    "gemsapi": {
      "type": "http",
      "url": "https://gemsapi.gemneye.info/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

## Quick smoke test

```bash
curl -X POST https://gemsapi.gemneye.info/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

## Available Tools

### `gems.list`
List all gems for the authenticated user. Returns id, name, description, creation date and a content checksum per gem.

### `gems.get`
Get one gem (full instructions) by UUID or by name. Argument: `identifier`.

## Troubleshooting

- **401 / "Missing Authorization" header** — the token header is absent or malformed; use `Authorization: Bearer <token>` exactly.
- **"Not Acceptable" error** — the client must send `Accept: application/json, text/event-stream`.
- **Claude Desktop can't connect** — the URL must be public HTTPS; `http://localhost` won't work for cloud connectors. Check the server is up at `/api/mcp/ping` with your token.
- **Wrong gems shown** — the token decides the user. A Supabase token shows that user's gems; `API_TOKEN` shows service-level access.

## Health check

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://gemsapi.gemneye.info/api/mcp/ping
```

Returns `{"status": "ok", ...}` when the token is valid.
