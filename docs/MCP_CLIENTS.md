# GemsAPI MCP Client Integration Guide

This guide explains how to connect various MCP-compatible clients to the GemsAPI MCP server.

## Overview

GemsAPI exposes an MCP (Model Context Protocol) interface that allows LLM clients to:
- **List gems**: View all your stored gems
- **Get gem details**: Retrieve full gem instructions by ID or name  
- **Search gems**: Find gems by name or description

## Available Transports

| Transport | Endpoint | Compatible Clients |
|-----------|----------|-------------------|
| SSE (Server-Sent Events) | `/mcp` | Cursor IDE, HTTP clients, web apps |
| STDIO (local script) | Download from `/api/mcp/stdio-script` | Claude Desktop, VS Code |

## Claude Desktop Setup

Claude Desktop requires a **local STDIO transport**. Follow these steps:

### Step 1: Download the MCP Script

```bash
# Download the script
curl -o gemsapi_mcp.py https://gemsapi.gemneye.info/api/mcp/stdio-script

# Or use wget
wget -O gemsapi_mcp.py https://gemsapi.gemneye.info/api/mcp/stdio-script
```

### Step 2: Install Dependencies

```bash
pip install fastmcp httpx
```

### Step 3: Configure Claude Desktop

Edit your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following configuration:

**Windows** (use full Python path):
```json
{
  "mcpServers": {
    "gemsapi": {
      "command": "D:\\Python\\Python313\\python.exe",
      "args": ["C:\\Users\\sruck\\AppData\\Local\\gemsapi\\gemsapi_mcp.py"],
      "env": {
        "GEMSAPI_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN",
        "GEMSAPI_URL": "https://gemsapi.gemneye.info"
      }
    }
  }
}
```

**macOS/Linux**:
```json
{
  "mcpServers": {
    "gemsapi": {
      "command": "python3",
      "args": ["/path/to/gemsapi_mcp.py"],
      "env": {
        "GEMSAPI_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN",
        "GEMSAPI_URL": "https://gemsapi.gemneye.info"
      }
    }
  }
}
```

**Important**:
- **Windows users**: Use the full path to your Python executable (e.g., `D:\Python\Python313\python.exe`). Windows often has multiple Python installations, and using the full path ensures the correct version with required modules is used.
- Replace the script path with the actual location where you saved the script
- Replace `YOUR_SUPABASE_ACCESS_TOKEN` with your Supabase access token

**Finding your Python path (Windows)**:
```bash
# Check where Python is installed
where python

# Check specific version
python -c "import sys; print(sys.executable)"
```

### Step 4: Restart Claude Desktop

Completely quit and restart Claude Desktop. Look for the hammer icon (🔨) in the input area to confirm MCP tools are available.

### Alternative: Using `uv` for Auto-Dependencies

If you have `uv` installed, you can skip the pip install step:

```json
{
  "mcpServers": {
    "gemsapi": {
      "command": "uv",
      "args": [
        "run",
        "--with", "fastmcp",
        "--with", "httpx",
        "python",
        "/path/to/gemsapi_mcp.py"
      ],
      "env": {
        "GEMSAPI_TOKEN": "YOUR_SUPABASE_ACCESS_TOKEN",
        "GEMSAPI_URL": "https://gemsapi.gemneye.info"
      }
    }
  }
}
```

## Cursor IDE Setup

Cursor supports remote SSE servers directly. Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "gemsapi": {
      "url": "https://gemsapi.gemneye.info/mcp",
      "transport": "sse",
      "headers": {
        "Authorization": "Bearer YOUR_SUPABASE_ACCESS_TOKEN"
      }
    }
  }
}
```

## HTTP Client Usage (curl, etc.)

You can interact with the SSE endpoint directly:

### List Tools
```bash
# First get the session endpoint
curl -N https://gemsapi.gemneye.info/mcp/

# Then use the returned session URL with JSON-RPC
curl -X POST https://gemsapi.gemneye.info/mcp/messages/?session_id=SESSION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Call a Tool
```bash
curl -X POST https://gemsapi.gemneye.info/mcp/messages/?session_id=SESSION_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gems.list","arguments":{}},"id":2}'
```

## Available Tools

### `gems.list`
Lists all gems for the authenticated user.

**Arguments**: None

**Returns**:
```json
{
  "gems": [
    {
      "id": "uuid",
      "name": "My Gem",
      "description": "A helpful gem",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### `gems.get`
Gets a specific gem by ID or name.

**Arguments**:
- `identifier` (string, required): The gem's UUID or name

**Returns**:
```json
{
  "schema_version": 1,
  "id": "uuid",
  "name": "My Gem",
  "description": "A helpful gem",
  "instructions": "You are a helpful assistant...",
  "checksum": "sha256_hash",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### `gems.search`
Searches gems by name or description.

**Arguments**:
- `query` (string, required): Search query

**Returns**:
```json
{
  "gems": [...],
  "query": "search term",
  "count": 5
}
```

## Available Resources

### `gems://list`
Returns a markdown-formatted list of all available gems.

### `gems://{identifier}`
Returns the full details of a specific gem in markdown format.

## Authentication

All requests require authentication via Bearer token:

- **Supabase Access Token**: Your user's Supabase JWT (recommended for multi-user)
- **API Token**: The server's `API_TOKEN` env var (for single-user/automation)

### Getting Your Supabase Token

1. Sign in to the GemsAPI web interface
2. Open browser DevTools (F12)
3. In Console, run: `localStorage.getItem('supabase.auth.token')`
4. Copy the `access_token` value

## Troubleshooting

### Claude Desktop: "Server transport closed unexpectedly"
- Ensure the script path is correct and the file exists
- **Windows users**: Use the full path to your Python executable in the config. Windows may have multiple Python installations, and Claude Desktop might pick the wrong one (e.g., Windows Store version) which lacks the required modules.
- Check that `GEMSAPI_TOKEN` is set correctly
- Verify fastmcp and httpx are installed in the Python installation you're using
- Run the script manually to confirm it starts: `python gemsapi_mcp.py`
- Check Claude Desktop logs for detailed errors

### "Not Acceptable" error with HTTP clients
Make sure to include the Accept header:
```
Accept: application/json, text/event-stream
```

### 401 Unauthorized
- Verify your token is valid and not expired
- For Supabase tokens, refresh by signing in again
- Check the token format: `Bearer <token>` (not just `<token>`)

### Tool not appearing in Claude Desktop
- Restart Claude Desktop completely (not just close the window)
- Check that the hammer icon (🔨) appears in the input area
- Verify the config JSON is valid (no trailing commas, etc.)

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/.well-known/mcp.json` | MCP manifest with server metadata |
| `/api/mcp/stdio-script` | Download STDIO script for Claude Desktop |
| `/api/mcp/claude-desktop-config` | Get Claude Desktop configuration example |
| `/api/mcp/ping` | Auth check endpoint |
| `/mcp` | SSE transport endpoint |

## Support

For issues or questions:
- Check the [phase-2-MCP.md](../phase-2-MCP.md) for implementation details
- Review server logs for error messages
- Ensure your environment variables are correctly set
