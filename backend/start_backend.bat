@echo off
cd /d "%~dp0"
echo Starting AI ArtBase Backend...
call venv\Scripts\activate.bat
set DISABLE_CHROMA=true
set APP_ENV=development
echo Environment variables set
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause


