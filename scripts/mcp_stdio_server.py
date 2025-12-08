#!/usr/bin/env python3
"""
GemsAPI MCP Server - STDIO Transport for Claude Desktop

This script runs a local MCP server that connects to the GemsAPI backend.
It's designed for use with Claude Desktop which requires STDIO transport.

Usage:
    1. Set environment variables:
       - GEMSAPI_URL: Base URL of your GemsAPI instance (default: https://gemsapi.gemneye.info)
       - GEMSAPI_TOKEN: Your Supabase access token or API token
    
    2. Run directly:
       python mcp_stdio_server.py
    
    3. Or configure in Claude Desktop's claude_desktop_config.json:
       {
         "mcpServers": {
           "gemsapi": {
             "command": "python",
             "args": ["/path/to/mcp_stdio_server.py"],
             "env": {
               "GEMSAPI_TOKEN": "your_token_here"
             }
           }
         }
       }

Requirements:
    pip install fastmcp httpx
"""

import os
import sys
import httpx
from typing import Optional
from fastmcp import FastMCP

# Configuration from environment
GEMSAPI_URL = os.getenv("GEMSAPI_URL", "https://gemsapi.gemneye.info")
GEMSAPI_TOKEN = os.getenv("GEMSAPI_TOKEN")

# Validate token early but don't crash - let MCP handle errors gracefully
if not GEMSAPI_TOKEN:
    # Write to stderr so it doesn't interfere with STDIO protocol
    print("Warning: GEMSAPI_TOKEN not set", file=sys.stderr)

# Create MCP server for STDIO transport
mcp = FastMCP(
    name="gemsapi",
    version="0.2.0",
)

# Lazy HTTP client initialization
_http_client: Optional[httpx.Client] = None


def get_http_client() -> httpx.Client:
    """Get or create the HTTP client with authentication."""
    global _http_client
    
    if _http_client is None:
        if not GEMSAPI_TOKEN:
            raise ValueError("GEMSAPI_TOKEN environment variable is required")
        
        _http_client = httpx.Client(
            base_url=GEMSAPI_URL,
            headers={
                "Authorization": f"Bearer {GEMSAPI_TOKEN}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
    
    return _http_client


@mcp.tool
def list_gems() -> dict:
    """List all gems for the authenticated user.
    
    Returns a list of gems with their id, name, description, and metadata.
    """
    try:
        client = get_http_client()
        response = client.get("/api/gems")
        response.raise_for_status()
        data = response.json()
        
        # Transform to match MCP tool output format
        gems = data if isinstance(data, list) else data.get("gems", data)
        return {
            "gems": [
                {
                    "id": gem.get("id"),
                    "name": gem.get("name"),
                    "description": gem.get("description"),
                    "created_at": gem.get("created_at"),
                }
                for gem in gems
            ]
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}", "detail": e.response.text}
    except Exception as e:
        return {"error": "Request failed", "detail": str(e)}


@mcp.tool
def get_gem(identifier: str) -> dict:
    """Get a specific gem by ID or name.
    
    Args:
        identifier: The gem's ID (UUID) or name
    
    Returns:
        The gem's full details including instructions.
    """
    try:
        client = get_http_client()
        # Try the package endpoint first (includes instructions)
        response = client.get(f"/api/gems/{identifier}/package")
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return {"error": "Gem not found", "identifier": identifier}
        return {"error": f"API error: {e.response.status_code}", "detail": e.response.text}
    except Exception as e:
        return {"error": "Request failed", "detail": str(e)}


@mcp.tool
def search_gems(query: str) -> dict:
    """Search for gems by name or description.
    
    Args:
        query: Search query string
    
    Returns:
        List of matching gems.
    """
    try:
        client = get_http_client()
        # Get all gems and filter locally (API may not have search endpoint)
        response = client.get("/api/gems")
        response.raise_for_status()
        data = response.json()
        
        gems = data if isinstance(data, list) else data.get("gems", data)
        query_lower = query.lower()
        
        matching = [
            {
                "id": gem.get("id"),
                "name": gem.get("name"),
                "description": gem.get("description"),
            }
            for gem in gems
            if query_lower in gem.get("name", "").lower()
            or query_lower in (gem.get("description") or "").lower()
        ]
        
        return {"gems": matching, "query": query, "count": len(matching)}
    except httpx.HTTPStatusError as e:
        return {"error": f"API error: {e.response.status_code}", "detail": e.response.text}
    except Exception as e:
        return {"error": "Request failed", "detail": str(e)}


if __name__ == "__main__":
    # Run with STDIO transport (default) for Claude Desktop
    # Don't print anything to stdout - it interferes with STDIO protocol
    mcp.run()
