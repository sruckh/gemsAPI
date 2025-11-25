import os
import logging
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from google import genai
from google.genai import types
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables
load_dotenv()

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEFAULT_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-pro-preview")
PORT = int(os.getenv("PORT", 8000))
NODE_ENV = os.getenv("NODE_ENV", "development")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(docs_url=None if NODE_ENV == "production" else "/docs")

# Rate Limiter Setup
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Supabase Client
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("Supabase credentials not found in environment variables.")
    supabase: Optional[Client] = None
else:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        supabase = None

# Gemini Client (New SDK)
if not GEMINI_API_KEY:
    logger.warning("Gemini API Key not found in environment variables.")
    gemini_client = None
else:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")
        gemini_client = None

# Models
class GemModel(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    instructions: str
    created_at: Optional[str] = None

class GenerateRequest(BaseModel):
    model_name: Optional[str] = DEFAULT_GEMINI_MODEL
    system_instructions: str
    user_prompt: str

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# API Routes
@app.get("/api/gems", response_model=List[GemModel])
async def get_gems():
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    try:
        response = supabase.table("gems").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching gems: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/gems", response_model=GemModel)
async def create_gem(gem: GemModel):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    try:
        gem_data = gem.model_dump(exclude_unset=True)
        response = supabase.table("gems").insert(gem_data).execute()
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=500, detail="Failed to create gem")
    except Exception as e:
        logger.error(f"Error creating gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.put("/api/gems/{gem_id}", response_model=GemModel)
async def update_gem(gem_id: str, gem: GemModel):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    try:
        gem_data = gem.model_dump(exclude={"id", "created_at"}, exclude_unset=True)
        response = supabase.table("gems").update(gem_data).eq("id", gem_id).execute()
        if response.data:
            return response.data[0]
        raise HTTPException(status_code=404, detail="Gem not found")
    except Exception as e:
        logger.error(f"Error updating gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.delete("/api/gems/{gem_id}")
async def delete_gem(gem_id: str):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    try:
        response = supabase.table("gems").delete().eq("id", gem_id).execute()
        return {"status": "deleted", "id": gem_id}
    except Exception as e:
        logger.error(f"Error deleting gem: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/gemini/generate")
@limiter.limit("5/minute")
async def generate_content(request: Request, body: GenerateRequest):
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    try:
        # Configure generation
        config = types.GenerateContentConfig(
            system_instruction=body.system_instructions
        )

        # Enable thinking capabilities for Gemini 3.0+ models
        # This is a heuristic based on the model name string
        if body.model_name and "gemini-3" in body.model_name.lower():
             config.thinking_config = types.ThinkingConfig(include_thoughts=True)

        response = await gemini_client.aio.models.generate_content(
            model=body.model_name,
            contents=body.user_prompt,
            config=config
        )

        # Construct response text including thoughts if present
        final_output = ""
        
        if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                # Check if this part is a "thought"
                # The SDK might expose this as a property 'thought' (boolean) on the part object
                # per the user provided sample: "if part.thought: ..."
                if hasattr(part, 'thought') and part.thought:
                    # Format thoughts as a blockquote for the frontend markdown renderer
                    final_output += f"> **Thinking Process:**\n> {part.text.replace(chr(10), chr(10) + '> ')}\n\n"
                elif part.text:
                    final_output += part.text
        else:
            # Fallback if no parts structure matches (or standard response)
            final_output = response.text if response.text else ""

        return {"text": final_output}

    except Exception as e:
        logger.error(f"Gemini API Error: {e}")
        # It's often helpful to log the exact error for debugging new SDKs
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate content")

# Static Files - Serve React App
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT, proxy_headers=True)
