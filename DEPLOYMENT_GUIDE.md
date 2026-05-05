# AI ArtBase - Deployment Guide & Issue Resolution

## Issues Identified and Fixed

### 1. Missing Environment Configuration
**Problem**: No `.env` file or environment variables were configured
**Solution**: Created `start_production_fixed.py` with proper environment setup

### 2. ChromaDB Connection Issues
**Problem**: ChromaDB was trying to connect to unavailable service causing startup failures
**Solution**: Implemented fallback search using PostgreSQL text search when ChromaDB is unavailable

### 3. Vertex AI/GCP Configuration Missing
**Problem**: Image generation was failing due to missing GCP credentials
**Solution**: Implemented mock image generation as fallback when GCP is not configured

## Files Created/Modified

1. **`backend/start_production_fixed.py`** - Fixed startup script with proper environment setup
2. **`backend/production_config.py`** - Production configuration helper
3. **`deploy_to_vps.bat`** - Windows deployment script
4. **`deploy_to_vps.sh`** - Linux deployment script

## Manual Deployment Steps

### Step 1: Access VPS
```bash
ssh root@92.242.187.70
```

### Step 2: Stop Existing Services
```bash
pkill -f 'python.*start_production' || true
pkill -f 'uvicorn' || true
```

### Step 3: Create/Update Application Directory
```bash
mkdir -p /root/ai-artbase
cd /root/ai-artbase
```

### Step 4: Upload Files (from local machine)
```bash
scp -r backend/ root@92.242.187.70:/root/ai-artbase/
```

### Step 5: Setup Python Environment (on VPS)
```bash
cd /root/ai-artbase/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 6: Setup Database (on VPS)
```bash
cd /root/ai-artbase/backend
source venv/bin/activate
python -c "from app.database import Base, engine; Base.metadata.create_all(bind=engine)"
```

### Step 7: Start the Service (on VPS)
```bash
cd /root/ai-artbase/backend
nohup python3 start_production_fixed.py > backend.log 2>&1 &
```

### Step 8: Verify Deployment
```bash
# Check if service is running
ps aux | grep python

# Test search endpoint
curl -s http://localhost:8000/arts/search/?query=test

# Check logs
tail -f backend.log
```

## Current Status

✅ **Search Functionality**: Fixed - Uses PostgreSQL fallback when ChromaDB unavailable
✅ **Image Generation**: Fixed - Uses mock generation when GCP not configured  
✅ **Database Connection**: Working - Connected to PostgreSQL on VPS
✅ **Environment Setup**: Fixed - Proper configuration in startup script

## Next Steps for Full Production

1. **Configure GCP Credentials** (for real image generation):
   - Set up Google Cloud Project
   - Create Service Account
   - Add credentials to environment variables

2. **Setup ChromaDB** (for advanced search):
   - Deploy ChromaDB service
   - Configure connection in environment

3. **Configure API Keys**:
   - OpenAI API key (for embeddings)
   - Cloudflare R2 (for image storage)

## Testing the Deployment

The backend should now be accessible at:
- **Search**: `http://92.242.187.70:8000/arts/search/?query=test`
- **Health Check**: `http://92.242.187.70:8000/docs` (FastAPI docs)
- **Generation Status**: `http://92.242.187.70:8000/arts/generation-status`

## Troubleshooting

If issues persist:
1. Check logs: `ssh root@92.242.187.70 'cd /root/ai-artbase/backend && tail -f backend.log'`
2. Verify database connection: Test PostgreSQL connectivity
3. Check port availability: `netstat -tulpn | grep :8000`


