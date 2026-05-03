# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependency files
COPY frontend/package.json frontend/package-lock.json* ./

# Install dependencies with legacy peer deps to resolve vite-plugin-pwa issues
RUN npm install --legacy-peer-deps

# Copy the rest of the frontend code and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python Backend
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies (if any needed for python packages)
RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY backend/ ./backend/

# Copy built frontend files from Stage 1 into backend's static directory
COPY --from=frontend-builder /app/frontend/dist ./backend/static/

# Render sets the PORT environment variable
ENV PORT=8000
EXPOSE $PORT

# Run the FastAPI server
CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT"]
