#!/usr/bin/env python3
import os
import sys

# Disable ChromaDB completely for testing
os.environ['DISABLE_CHROMA'] = 'true'
os.environ['APP_ENV'] = 'development'

try:
    print("🚀 Starting FastAPI backend without ChromaDB...")
    
    # Import after setting environment
    from app.main import app
    import uvicorn
    
    print("✅ App imported successfully")
    print("🌐 Starting server on http://localhost:8000")
    
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)






