#!/usr/bin/env python3
import os
import sys

# Configure to use VM ChromaDB (now working!)
os.environ['APP_ENV'] = 'production'  # Use production mode for ChromaDB
os.environ['CHROMA_HOST'] = '92.242.187.70'  # Your VM IP
os.environ['CHROMA_PORT'] = '8001'  # ChromaDB port on VM

# Remove the disable flag since ChromaDB is now working
if 'DISABLE_CHROMA' in os.environ:
    del os.environ['DISABLE_CHROMA']

try:
    print("🚀 Starting AI ArtBase Backend with VM ChromaDB...")
    print(f"📡 ChromaDB: {os.environ['CHROMA_HOST']}:{os.environ['CHROMA_PORT']}")
    print(f"🔧 Environment: {os.environ['APP_ENV']}")
    
    # Import after setting environment
    from app.main import app
    import uvicorn
    
    print("✅ App imported successfully")
    print("🌐 Starting server on http://localhost:8000")
    print("🔍 Search and similar images will now use REAL semantic similarity!")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)






