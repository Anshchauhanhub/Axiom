#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "🚀 Starting unified build process for Axiom..."

echo "📦 1/3: Installing and building Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "🚚 2/3: Moving frontend build to backend static directory..."
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/dist/* backend/static/

echo "🐍 3/3: Installing Backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

echo "✅ Build complete!"
