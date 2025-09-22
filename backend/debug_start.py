#!/usr/bin/env python3
import sys
import traceback
import os

try:
    print("1. Setting up environment...")
    os.environ.setdefault('APP_ENV', 'production')
    
    print("2. Importing database...")
    from app.database import engine
    print("✅ Database imported successfully")
    
    print("3. Testing database connection...")
    with engine.connect() as conn:
        print("✅ Database connection successful")
    
    print("4. Importing app.main...")
    from app.main import app
    print("✅ App imported successfully")
    
    print("5. Importing uvicorn...")
    import uvicorn
    print("✅ Uvicorn imported successfully")
    
    print("6. Starting server on 0.0.0.0:8000...")
    print("🚀 Server should be accessible at http://localhost:8000")
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
    
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n🔍 Full traceback:")
    traceback.print_exc()
    sys.exit(1)
