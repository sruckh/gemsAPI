# gemsAPI

This project simulates Google Gemini Gems capabilities, providing a flexible interface for managing and executing custom AI instructions ("Gems").

## Project Overview

Since the standard Gemini Gems interface does not currently support direct API access, this project emulates that functionality by:

1.  **Storage:** Storing Gem definitions (system instructions, prompts) in a Supabase database.
2.  **Execution:** Providing a FastAPI backend service that reads Gem definitions from Supabase and combines them with user input to execute requests via the Gemini API.
3.  **Management:** Offering a React-based web interface for creating, editing, and testing Gems.

## Architecture

*   **Frontend:** React (Vite)
*   **Backend:** FastAPI (Python)
*   **Database:** Supabase (PostgreSQL)
*   **AI Model:** Google Gemini

## Roadmap

*   [x] Initial Project Setup
*   [ ] Dockerize the application
*   [ ] Configure Nginx Proxy Manager for secure deployment
*   [ ] Setup private networking (Docker `shared_net`) to avoid exposing ports on localhost

## Setup

### Prerequisites

*   Node.js
*   Python 3.x
*   Supabase Account
*   Google Gemini API Key

### Installation

1.  Install Node dependencies:
    ```bash
    npm install
    ```

2.  Install Python dependencies:
    ```bash
    pip install fastapi uvicorn google-generativeai supabase python-dotenv
    ```

3.  Configure Environment Variables:
    Create a `.env` file (or `.env.local`) with the following:
    ```
    GEMINI_API_KEY=your_gemini_key
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_anon_key
    ```

### Running Locally

**Frontend:**
```bash
npm run dev
```

**Backend:**
```bash
uvicorn fastapi_server:app --reload
```