import os
import logging
import re
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
import traceback

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

# --- Models ---
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

class ExecuteGemRequest(BaseModel):
    gem_name: str
    user_prompt: str
    model_name: Optional[str] = DEFAULT_GEMINI_MODEL

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helpers ---
def clean_thought_text(text: str) -> str:
    """
    Removes the model's internal thinking tags (<thought>...</thought> and <Sig_X>)
    from the generated text, as these cannot be disabled in the Gemini 3 API.

    Args:
        text: The raw response text from the model.

    Returns:
        The cleaned text, suitable for display to the end-user.
    """
    # 1. Remove the standard <ctrl3348>...</thought> tags and content
    cleaned_text = re.sub(r'<ctrl3348>.*?<\/thought>', '', text, flags=re.DOTALL)

    # 2. Remove any thought signatures (e.g., <Sig_A> or <Sig_B>)
    cleaned_text = re.sub(r'<Sig_[A-Z]>', '', cleaned_text)

    # Clean up excessive whitespace or newlines left by the removal
    cleaned_text = cleaned_text.strip()
    return cleaned_text

async def generate_gemini_response(model_name: str, system_instructions: str, user_prompt: str) -> str:
    """
    Reusable helper to generate content from Gemini, handling thinking config and response parsing.
    """
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service unavailable")

    # Fallback for missing/deprecated model
    if model_name == "gemini-1.5-flash":
        logger.warning(f"Model '{model_name}' not found/supported. Falling back to DEFAULT_GEMINI_MODEL: {DEFAULT_GEMINI_MODEL}")
        model_name = DEFAULT_GEMINI_MODEL

    # Use default if no model provided
    if not model_name:
        model_name = DEFAULT_GEMINI_MODEL

    try:
        # Configure generation
        config = types.GenerateContentConfig(
            system_instruction=system_instructions
        )

        # Enable LOW thinking level for Gemini 3.0+ models for faster, lower-latency responses
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

        # Get the raw response text
        raw_text = response.text if response.text else ""

        # Clean the response to remove internal thinking tags
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

# Raw Generation Endpoint (Free-form)
@app.post("/api/gemini/generate")
@limiter.limit("5/minute")
async def generate_content(request: Request, body: GenerateRequest):
    text = await generate_gemini_response(
        model_name=body.model_name,
        system_instructions=body.system_instructions,
        user_prompt=body.user_prompt
    )
    return {"text": text}

# Named Gem Execution Endpoint (API-First Feature)
@app.post("/api/gems/execute")
@limiter.limit("5/minute")
async def execute_gem_by_name(request: Request, body: ExecuteGemRequest):
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")

    try:
        # Lookup Gem by name (case-sensitive usually, depending on DB collation)
        response = supabase.table("gems").select("instructions").eq("name", body.gem_name).limit(1).execute()
        
        if not response.data:
             raise HTTPException(status_code=404, detail=f"Gem '{body.gem_name}' not found")
        
        instructions = response.data[0]['instructions']
        
    except Exception as e:
        logger.error(f"Error looking up gem '{body.gem_name}': {e}")
        raise HTTPException(status_code=500, detail="Database lookup failed")

    # Generate response using the retrieved instructions
    text = await generate_gemini_response(
        model_name=body.model_name,
        system_instructions=instructions,
        user_prompt=body.user_prompt
    )
    
    return {"text": text}

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