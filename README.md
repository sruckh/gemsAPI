# gemsAPI

This project simulates Google Gemini Gems capabilities, providing a flexible interface for managing and executing custom AI instructions ("Gems"). It is designed to run as a containerized service, leveraging the latest Gemini 3.0 models with low-latency thinking capabilities.

## Project Overview

Since the standard Gemini Gems interface does not currently support direct API access, this project emulates that functionality by:

1.  **Storage:** Storing Gem definitions (system instructions, prompts) in a Supabase database.
2.  **Execution:** Providing a FastAPI backend service that reads Gem definitions from Supabase and combines them with user input to execute requests via the Google Gemini API (using the latest `google-genai` SDK).
3.  **Management:** Offering a React-based web interface for creating, editing, and testing Gems.
4.  **Optimization:** Automatically handling Gemini 3.0 "thinking" artifacts and optimizing for low latency.

## Architecture

*   **Frontend:** React (Vite) - Served statically by FastAPI in production
*   **Backend:** FastAPI (Python)
*   **Database:** Supabase (PostgreSQL)
*   **AI Model:** Google Gemini (Supports 1.5, 2.0, and 3.0 series)

## Roadmap

*   [x] Initial Project Setup
*   [x] Dockerize the application (Multi-stage build)
*   [x] Configure Nginx Proxy Manager for secure deployment
*   [x] Setup private networking (Docker `shared_net`) to avoid exposing ports on localhost

## API Endpoints

*   `POST /api/gems/execute`: Execute a specific Gem by name.
    *   Body: `{"gem_name": "Name", "user_prompt": "..."}`
*   `POST /api/gemini/generate`: Direct access to the configured Gemini model.
    *   Body: `{"system_instructions": "...", "user_prompt": "..."}`
*   `GET /api/gems`: List all available Gems.

## Setup

### Prerequisites

*   Docker & Docker Compose (Recommended)
*   Supabase Account
*   Google Gemini API Key

### Security hygiene

*   Keep `SUPABASE_KEY` and `API_TOKEN` server-only; never add them to `VITE_*` variables or frontend code.
*   The backend fails to start if a service key is exposed to the frontend or bundled into `dist`.
*   Before committing, run `npm run secret:check` to scan for leaked tokens in assets, source, and docs.

### Environment Variables

Create a `.env` file with the following:
```env
GEMINI_API_KEY=your_gemini_key
# Model to use (defaults to gemini-3-pro-preview if unset)
GEMINI_MODEL=gemini-3-pro-preview
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
PORT=8000
NODE_ENV=production
```

### Docker Deployment (Recommended)

This project is designed to be run via Docker Compose.

1.  **Build and Start:**
    ```bash
    docker compose up -d --build
    ```

2.  **Access:**
    *   The service runs on port `8000` inside the container.
    *   It connects to the external `shared_net` network.
    *   Configure your reverse proxy (e.g., Nginx Proxy Manager) to point to the container name `gemsapi` on port `8000`.

### Local Development (Manual)

If you wish to run without Docker:

1.  **Install Node dependencies:**
    ```bash
    npm install
    ```

2.  **Install Python dependencies:**
    ```bash
    pip install fastapi uvicorn google-genai supabase python-dotenv slowapi pydantic httpx aiofiles
    ```

3.  **Run Frontend:**
    ```bash
    npm run dev
    ```

4.  **Run Backend:**
    ```bash
    uvicorn fastapi_server:app --reload
    ```
