#!/usr/bin/env python3
"""
Production-ready local backend with robust search and similar images.
Uses PostgreSQL on VM but implements smart fallback for ChromaDB.
"""
import os
import sys

# Configure for production-ready local development
os.environ['APP_ENV'] = 'development'  # Use local mode for now
os.environ['DATABASE_URL'] = 'postgresql://postgres:pirate228@92.242.187.70:5432/Ai_ArtBase'

# Remove ChromaDB disable flag to allow fallback logic
if 'DISABLE_CHROMA' in os.environ:
    del os.environ['DISABLE_CHROMA']

try:
    print("🚀 Starting AI ArtBase Backend (Production-Ready Local)")
    print(f"🗄️  Database: VM PostgreSQL (92.242.187.70:5432)")
    print(f"🔍 Search: Smart fallback with keyword matching")
    print(f"🖼️  Similar Images: Semantic keyword-based similarity")
    
    # Import after setting environment
    from app.main import app
    import uvicorn
    
    print("✅ App imported successfully")
    print("🌐 Starting server on http://localhost:8000")
    print("🎯 Production-ready with robust error handling!")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

