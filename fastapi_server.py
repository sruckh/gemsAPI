import os
import logging
import re
import traceback
import hashlib
from typing import Optional, List, Union, Callable, Awaitable

from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai
from google.genai import types
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastmcp import FastMCP

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
PORT = int(os.getenv("PORT", 8000))
NODE_ENV = os.getenv("NODE_ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL")
VITE_SUPABASE_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")
VITE_SUPABASE_KEY = os.getenv("VITE_SUPABASE_KEY")  # should never be set; service keys must stay server-only
ENABLE_MCP = os.getenv("ENABLE_MCP", "false").lower() == "true"

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(docs_url=None if NODE_ENV == "production" else "/docs")

# Rate Limiter Setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security Scheme
security = HTTPBearer()

# Global Supabase Client (for admin/public ops only if needed, effectively deprecated for data ops)
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials not found in environment variables.")
    supabase: Optional[Client] = None
else:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

# Gemini Client
if not GEMINI_API_KEY:
    logger.warning("Gemini API Key not found in environment variables.")
    gemini_client = None
else:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
        gemini_client = None

# --- Models ---
class GemModel(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    instructions: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class GenerateRequest(BaseModel):
    model_name: Optional[str] = DEFAULT_GEMINI_MODEL
    system_instructions: str
    user_prompt: str

class ExecuteGemRequest(BaseModel):
    gem_name: str
    user_prompt: str
    model_name: Optional[str] = DEFAULT_GEMINI_MODEL

class AuthCheckRequest(BaseModel):
    email: str

class RegisterAdminRequest(BaseModel):
    email: str

class GemPackage(BaseModel):
    schema_version: int = 1
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: str
    checksum: str
    updated_at: Optional[str] = None

class MCPManifest(BaseModel):
    name: str
    version: str
    description: str
    server_url: str
    resources: List[str]
    tools: List[str]
    auth: dict

# --- Middleware ---
allowed_origins = []
if NODE_ENV == "development":
    allowed_origins = ["*"]
elif FRONTEND_URL:
    allowed_origins = [FRONTEND_URL]
else:
    logger.warning("NODE_ENV is production but FRONTEND_URL is not set. CORS might block requests.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Dependencies ---
def get_user_supabase_client(token: HTTPAuthorizationCredentials = Depends(security)) -> Client:
    """
    Creates a Supabase client authenticated as the user from the Bearer token.
    This ensures RLS policies are applied.
    Allows bypass if a valid API_TOKEN is provided.
    """
    # Check for API Token Bypass
    api_token = os.getenv("API_TOKEN")
    if api_token and token.credentials == api_token:
        if not supabase:
             raise HTTPException(status_code=503, detail="Database service unavailable")
        return supabase

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    try:
        # Initialize with the URL and Key (Anon key usually)
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Set the session using the token
        client.auth.set_session(access_token=token.credentials, refresh_token=token.credentials)
        return client
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

def get_current_user_email(token: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """
    Verifies the token and returns the user's email.
    Allows bypass if a valid API_TOKEN is provided.
    """
    # Check for API Token Bypass
    api_token = os.getenv("API_TOKEN")
    if api_token and token.credentials == api_token:
        return "api_user@internal"

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        user_response = client.auth.get_user(token.credentials)
        
        if not user_response or not user_response.user or not user_response.user.email:
            raise HTTPException(status_code=401, detail="Invalid token or email not found")
            
        return user_response.user.email
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# --- Helpers ---
def clean_thought_text(text: str) -> str:
    cleaned_text = re.sub(r'<ctrl3348>.*?<\/thought>', '', text, flags=re.DOTALL)
    cleaned_text = re.sub(r'<Sig_[A-Z]>', '', cleaned_text)
    cleaned_text = cleaned_text.strip()
    return cleaned_text

def compute_checksum(text: str) -> str:
    """Return a stable SHA-256 checksum for caching/validation."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def _ensure_secrets_not_exposed():
    """
    Hard-stop startup if sensitive keys are misconfigured or leaked into the built frontend.
    - Service role key must never match the anon key.
    - VITE_SUPABASE_KEY must not be set (prevents bundling service key to client).
    - Scan dist assets for SUPABASE_KEY or API_TOKEN bytes.
    """
    service_key = SUPABASE_KEY or ""
    anon_key = VITE_SUPABASE_ANON_KEY or ""
    api_token = os.getenv("API_TOKEN", "")

    if VITE_SUPABASE_KEY:
        raise RuntimeError("VITE_SUPABASE_KEY is set; service role key must never be exposed to the frontend. Remove it.")

    if service_key and anon_key and service_key == anon_key:
        raise RuntimeError("Supabase service role key matches anon key. Rotate keys so service and anon differ.")

    dist_dir = "dist"
    secrets_to_check = [service_key.encode() if service_key else b"", api_token.encode() if api_token else b""]
    secrets_to_check = [s for s in secrets_to_check if s]

    if secrets_to_check and os.path.isdir(dist_dir):
        for root, _, files in os.walk(dist_dir):
            for fname in files:
                path = os.path.join(root, fname)
                try:
                    with open(path, "rb") as fh:
                        blob = fh.read()
                        for secret in secrets_to_check:
                            if secret and secret in blob:
                                raise RuntimeError(f"Secret material detected in built asset: {path}. Rebuild after removing leaks.")
                except Exception as e:
                    # Non-fatal read issues; continue scanning but log for visibility without secrets.
                    logger.warning(f"Skipped secret scan for {path}: {e}")

async def generate_gemini_response(model_name: str, system_instructions: str, user_prompt: str) -> str:
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    if model_name == "gemini-1.5-flash":
        logger.warning(f"Model '{model_name}' not found/supported. Falling back to DEFAULT_GEMINI_MODEL: {DEFAULT_GEMINI_MODEL}")
        model_name = DEFAULT_GEMINI_MODEL

    if not model_name:
        model_name = DEFAULT_GEMINI_MODEL

    try:
        config = types.GenerateContentConfig(
            system_instruction=system_instructions
        )

        if "gemini-3" in model_name.lower():
             config.thinking_config = types.ThinkingConfig(
                 thinking_level=types.ThinkingLevel.LOW,
                 include_thoughts=True
             )

        response = await gemini_client.aio.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=config
        )

        raw_text = response.text if response.text else ""
        final_output = clean_thought_text(raw_text)
        return final_output

    except Exception as e:
        logger.error(f"Gemini API Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate content")

# --- API Routes ---

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/gems", response_model=List[GemModel])
async def get_gems(client: Client = Depends(get_user_supabase_client)):
    try:
        response = client.table("gems").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching gems: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/gems", response_model=GemModel)
async def create_gem(gem: GemModel, client: Client = Depends(get_user_supabase_client)):
    try:
        gem_data = gem.model_dump(exclude_unset=True)
        # Supabase RLS will attach the user_id automatically if configured with default values or triggers,
        # but normally we rely on the auth context.
        response = client.table("gems").insert(gem_data).execute()
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=500, detail="Failed to create gem")
    except Exception as e:
        logger.error(f"Error creating gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/gems/{gem_id}", response_model=GemModel)
async def update_gem(gem_id: str, gem: GemModel, client: Client = Depends(get_user_supabase_client)):
    try:
        gem_data = gem.model_dump(exclude={"id", "created_at"}, exclude_unset=True)
        # Note: .select("*") is not supported on the filter builder returned by .eq() in some versions.
        # .execute() usually returns the data.
        response = client.table("gems").update(gem_data).eq("id", gem_id).execute()
        if response.data:
            return response.data[0]
        
        # If no data returned, it might mean the row wasn't found or permission denied (RLS)
        # OR the library didn't return it. Let's try to fetch it just in case, 
        # but usually empty data on update means no match.
        raise HTTPException(status_code=404, detail="Gem not found or permission denied")
    except Exception as e:
        logger.error(f"Error updating gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/gems/{gem_id}")
async def delete_gem(gem_id: str, client: Client = Depends(get_user_supabase_client)):
    try:
        response = client.table("gems").delete().eq("id", gem_id).execute()
        return {"status": "deleted", "id": gem_id}
    except Exception as e:
        logger.error(f"Error deleting gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# --- Helper for fetching gem by id or name ---
def _fetch_gem_by_identifier(client: Client, identifier: str) -> Optional[dict]:
    """Try to fetch gem by UUID id first; if not UUID or not found, fetch by name."""
    try:
        # attempt id
        response = client.table("gems").select("*").eq("id", identifier).limit(1).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        logger.debug(f"Fetch by id failed for {identifier}: {e}")
    try:
        response = client.table("gems").select("*").eq("name", identifier).limit(1).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        logger.error(f"Fetch by name failed for {identifier}: {e}")
    return None

def _supabase_client_for_token(token: str) -> Client:
    """
    Return a Supabase client based on a bearer token.
    - If token matches API_TOKEN, return the global service-role client.
    - Otherwise, treat token as a Supabase access token and set session.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    api_token = os.getenv("API_TOKEN")
    if api_token and token == api_token:
        if not supabase:
            raise HTTPException(status_code=503, detail="Database service unavailable")
        return supabase

    try:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        client.auth.set_session(access_token=token, refresh_token=token)
        return client
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# --- REST prompt-package endpoint ---
@app.get("/api/gems/{identifier}/package", response_model=GemPackage)
@limiter.limit("10/minute")
async def get_gem_package(identifier: str, client: Client = Depends(get_user_supabase_client)):
    gem = _fetch_gem_by_identifier(client, identifier)
    if not gem:
        raise HTTPException(status_code=404, detail="Gem not found")

    checksum = compute_checksum(gem.get("instructions", ""))
    pkg = GemPackage(
        id=gem.get("id"),
        name=gem.get("name"),
        description=gem.get("description"),
        instructions=gem.get("instructions", ""),
        checksum=checksum,
        updated_at=gem.get("updated_at"),
    )
    return pkg

# Raw Generation Endpoint (Free-form) - Protected?
# The user can likely only use this if authenticated, to prevent abuse.
# But for now, I'll leave it public but rate limited, as it's not accessing DB.
@app.post("/api/gemini/generate")
@limiter.limit("5/minute")
async def generate_content(request: Request, body: GenerateRequest):
    text = await generate_gemini_response(
        model_name=body.model_name,
        system_instructions=body.system_instructions,
        user_prompt=body.user_prompt
    )
    return {"text": text}

# Named Gem Execution Endpoint
# Should respect RLS for fetching the Gem instructions
@app.post("/api/gems/execute")
@limiter.limit("5/minute")
async def execute_gem_by_name(
    request: Request, 
    body: ExecuteGemRequest, 
    client: Client = Depends(get_user_supabase_client)
):
    try:
        # Lookup Gem by name using the authenticated client
        response = client.table("gems").select("instructions").eq("name", body.gem_name).limit(1).execute()
        
        if not response.data:
             raise HTTPException(status_code=404, detail=f"Gem '{body.gem_name}' not found")
        
        instructions = response.data[0]['instructions']
        
    except Exception as e:
        logger.error(f"Error looking up gem '{body.gem_name}': {e}")
        raise HTTPException(status_code=500, detail="Database lookup failed")

    text = await generate_gemini_response(
        model_name=body.model_name,
        system_instructions=instructions,
        user_prompt=body.user_prompt
    )
    
    return {"text": text}

# --- MCP / LLM-friendly endpoints (read-only first phase) ---
if ENABLE_MCP:

    @app.get("/api/mcp/ping")
    @limiter.limit("10/minute")
    async def mcp_ping(user_email: str = Depends(get_current_user_email)):
        """Auth check for MCP clients; returns ok if bearer is valid."""
        return {"status": "ok", "user": user_email}

    # FastMCP server (read-only tools first)
    mcp_server = FastMCP(
        name="gemsapi-mcp",
        version="0.2.0",
        description="MCP interface for Gems stored in Supabase",
    )

    @mcp_server.tool("gems.list")
    async def mcp_list(auth_token: str) -> dict:
        client = _supabase_client_for_token(auth_token)
        response = client.table("gems").select("id,name,description,updated_at").order("updated_at", desc=True).execute()
        data = response.data or []
        for row in data:
            row["checksum"] = compute_checksum(row.get("id", "") + row.get("name", ""))
            row["schema_version"] = 1
        return {"gems": data}

    @mcp_server.tool("gems.get")
    async def mcp_get(identifier: str, auth_token: str) -> dict:
        client = _supabase_client_for_token(auth_token)
        gem = _fetch_gem_by_identifier(client, identifier)
        if not gem:
            raise HTTPException(status_code=404, detail="Gem not found")
        return {
            "schema_version": 1,
            "id": gem.get("id"),
            "name": gem.get("name"),
            "description": gem.get("description"),
            "instructions": gem.get("instructions", ""),
            "checksum": compute_checksum(gem.get("instructions", "")),
            "updated_at": gem.get("updated_at"),
        }

    # Expose MCP manifest and mount FastMCP ASGI app under /mcp
    @app.get("/.well-known/mcp.json", response_model=MCPManifest)
    async def mcp_manifest(request: Request):
        base = str(request.base_url).rstrip("/")
        return MCPManifest(
            name="gemsapi-mcp",
            version="0.2.0",
            description="MCP interface for Gems stored in Supabase",
            server_url=f"{base}/mcp",
            resources=["gems.list", "gems.get"],
            tools=["gems.list", "gems.get"],
            auth={
                "type": "bearer",
                "header": "Authorization",
                "format": "Bearer <token>",
                "arg_name": "auth_token"
            }
        )

    # Mount FastMCP HTTP app
    app.mount("/mcp", mcp_server.http_app())

# --- Authentication Endpoints ---
@app.post("/api/auth/check-admin")
async def check_admin_status(
    request: AuthCheckRequest,
    user_email: str = Depends(get_current_user_email)
):
    """Check if the authenticated user is an admin"""
    # Ignore request.email, use verified user_email
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        # Use the service role client (global supabase) to check admin table
        # assuming admin_users table might be readable by public or restricted.
        # Safest is to use the global client to read the admin table for the specific email.
        response = supabase.table("admin_users").select("*").eq("email", user_email).execute()
        if response.data:
            return {"isAdmin": True, "role": response.data[0]["role"]}
        else:
            return {"isAdmin": False}
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/auth/register-admin")
async def register_first_admin(request: RegisterAdminRequest):
    """Register first user as admin if no admin exists"""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        # Check if any admin users already exist
        existing_admins = supabase.table("admin_users").select("*").execute()

        if existing_admins.data:
            return {"success": False, "message": "Admin user already exists"}

        # No admin exists, register this user as admin
        # Note: This is still a public endpoint but only works once.
        admin_data = {
            "email": request.email,
            "role": "admin"
        }
        response = supabase.table("admin_users").insert(admin_data).execute()

        if response.data:
            return {"success": True, "message": "First admin registered successfully"}
        else:
            return {"success": False, "message": "Failed to register admin"}

    except Exception as e:
        logger.error(f"Error registering admin: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Static Files
if os.path.exists("dist"):
    app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        file_path = os.path.join("dist", catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse("dist/index.html")
else:
    logger.warning("'dist' directory not found. Static files will not be served.")
    @app.get("/")
    def root():
        return {"message": "API is running. Frontend not built/found."}

@app.on_event("startup")
async def security_startup_checks():
    """
    Enforce invariant that no sensitive keys are accidentally shipped to clients.
    Raises at startup to fail fast in misconfigured environments.
    """
    _ensure_secrets_not_exposed()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, proxy_headers=True)
