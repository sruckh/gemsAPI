# Stage 1: Builder
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend
# Note: ensuring no sensitive VITE_ env vars are present
RUN npm run build

# Stage 2: Runner
FROM python:3.12-slim

WORKDIR /app

# Create a non-root user
RUN useradd -m appuser

# Copy built assets from builder stage
COPY --from=builder /app/dist /app/dist

# Copy backend requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY fastapi_server.py .
# Copy .env.example just in case, though .env is mounted
COPY .env.example .

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the port (internal only)
EXPOSE 8000

# Run the application
CMD ["uvicorn", "fastapi_server:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
