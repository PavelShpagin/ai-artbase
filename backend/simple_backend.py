#!/usr/bin/env python3
import os
import sys
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Set environment to avoid ChromaDB issues
os.environ['DISABLE_CHROMA'] = 'true'
os.environ['APP_ENV'] = 'development'

app = FastAPI(title="AI ArtBase API - Simple Mode")

# Add CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174", 
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://localhost:5180",
        "http://localhost:5181",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AI ArtBase API - Simple Mode", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Import database after setting environment
try:
    from app.database import SessionLocal
    from app import models
    print("✅ Database imported successfully")
    
    @app.get("/arts/")
    def get_arts(limit: int = 50):
        try:
            db = SessionLocal()
            arts = db.query(models.Art).filter(models.Art.is_public == True).limit(limit).all()
            result = []
            for art in arts:
                result.append({
                    "id": art.id,
                    "src": art.src,
                    "prompt": art.prompt,
                    "descriptive_prompt": art.descriptive_prompt,
                    "width": art.width,
                    "height": art.height,
                    "premium": art.premium,
                    "date": art.date.isoformat() if art.date else None,
                    "owner_id": art.owner_id,
                    "num_likes": art.num_likes,
                    "is_generated": art.is_generated,
                    "is_public": art.is_public,
                    "liked_by_user": False  # Default for now
                })
            db.close()
            return result
        except Exception as e:
            print(f"Error in get_arts: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    @app.get("/arts/search/")
    def search_arts(query: str):
        try:
            db = SessionLocal()
            # Simple text search since ChromaDB is disabled
            arts = db.query(models.Art).filter(
                models.Art.prompt.contains(query)
            ).filter(models.Art.is_public == True).limit(50).all()
            
            result = []
            for art in arts:
                result.append({
                    "id": art.id,
                    "src": art.src,
                    "prompt": art.prompt,
                    "descriptive_prompt": art.descriptive_prompt,
                    "width": art.width,
                    "height": art.height,
                    "premium": art.premium,
                    "date": art.date.isoformat() if art.date else None,
                    "owner_id": art.owner_id,
                    "num_likes": art.num_likes,
                    "is_generated": art.is_generated,
                    "is_public": art.is_public,
                    "liked_by_user": False
                })
            db.close()
            return result
        except Exception as e:
            print(f"Error in search_arts: {e}")
            return []  # Return empty array instead of error
    
    # Add the endpoint that the frontend is actually calling
    @app.get("/search/")
    def search_arts_frontend(query: str):
        # Redirect to the main search function
        return search_arts(query)
    
    @app.get("/arts/similar/{art_id}")
    def get_similar_arts(art_id: int):
        try:
            db = SessionLocal()
            
            # Get the original art to find similar ones
            original_art = db.query(models.Art).filter(models.Art.id == art_id).first()
            if not original_art:
                # If art not found, return random arts
                from sqlalchemy import func
                arts = db.query(models.Art).filter(
                    models.Art.is_public == True
                ).order_by(func.random()).limit(20).all()
            else:
                # Try to find arts with similar keywords in prompts
                prompt_words = original_art.prompt.lower().split() if original_art.prompt else []
                
                # Look for arts containing similar keywords (basic similarity)
                similar_arts = []
                if prompt_words:
                    for word in prompt_words[:5]:  # Use first 5 words
                        if len(word) > 3:  # Only meaningful words
                            word_arts = db.query(models.Art).filter(
                                models.Art.prompt.ilike(f'%{word}%')
                            ).filter(models.Art.id != art_id).filter(
                                models.Art.is_public == True
                            ).limit(10).all()
                            similar_arts.extend(word_arts)
                
                # Remove duplicates and limit
                seen_ids = set()
                unique_arts = []
                for art in similar_arts:
                    if art.id not in seen_ids:
                        unique_arts.append(art)
                        seen_ids.add(art.id)
                
                # If we don't have enough, fill with random ones
                if len(unique_arts) < 20:
                    from sqlalchemy import func
                    random_arts = db.query(models.Art).filter(
                        models.Art.id != art_id
                    ).filter(models.Art.id.notin_(seen_ids)).filter(
                        models.Art.is_public == True
                    ).order_by(func.random()).limit(20 - len(unique_arts)).all()
                    unique_arts.extend(random_arts)
                
                arts = unique_arts[:20]
            
            result = []
            for art in arts:
                result.append({
                    "id": art.id,
                    "src": art.src,
                    "prompt": art.prompt,
                    "descriptive_prompt": art.descriptive_prompt,
                    "width": art.width,
                    "height": art.height,
                    "premium": art.premium,
                    "date": art.date.isoformat() if art.date else None,
                    "owner_id": art.owner_id,
                    "num_likes": art.num_likes,
                    "is_generated": art.is_generated,
                    "is_public": art.is_public,
                    "liked_by_user": False
                })
            db.close()
            return result
        except Exception as e:
            print(f"Error in get_similar_arts: {e}")
            return []
            
except Exception as e:
    print(f"❌ Database import failed: {e}")
    
    @app.get("/arts/")
    def get_arts_fallback():
        return {"error": "Database not available", "arts": []}
    
    @app.get("/arts/search/")
    def search_arts_fallback(query: str = ""):
        return []
    
    @app.get("/search/")
    def search_arts_frontend_fallback(query: str = ""):
        return []
    
    @app.get("/arts/similar/{art_id}")
    def get_similar_arts_fallback(art_id: int):
        return []

if __name__ == "__main__":
    print("🚀 Starting Simple Backend on http://localhost:8000")
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        import traceback
        traceback.print_exc()
