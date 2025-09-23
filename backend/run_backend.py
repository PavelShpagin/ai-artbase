#!/usr/bin/env python3
import os
import sys
from threading import Thread
import time

# Set environment variables
os.environ['DISABLE_CHROMA'] = 'true'
os.environ['APP_ENV'] = 'development'

def run_server():
    try:
        print("🔧 Importing FastAPI components...")
        from fastapi import FastAPI
        from fastapi.middleware.cors import CORSMiddleware
        
        print("🔧 Creating FastAPI app...")
        app = FastAPI(title="AI ArtBase API", version="1.0.0")
        
        # Add CORS
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5181", "http://localhost:5173"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        @app.get("/")
        def read_root():
            return {"message": "AI ArtBase API is running!", "status": "healthy"}
        
        @app.get("/health")
        def health_check():
            return {"status": "healthy", "timestamp": time.time()}
            
        print("🔧 Importing database...")
        from app.database import SessionLocal
        from app import models
        
        @app.get("/arts/")
        def get_arts_simple():
            try:
                db = SessionLocal()
                arts = db.query(models.Art).limit(10).all()
                db.close()
                return [{"id": art.id, "prompt": art.prompt[:50] + "..."} for art in arts]
            except Exception as e:
                return {"error": str(e)}
        
        print("🚀 Starting server on port 8002...")
        import uvicorn
        uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_server()






