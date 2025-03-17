from fastapi import APIRouter, BackgroundTasks
import subprocess
import sys
import os
from pathlib import Path

router = APIRouter()

def run_scraper():
    scraper_path = Path(__file__).parent.parent.parent.parent / "scraper" / "civitai-scraper.js"
    subprocess.Popen(["node", str(scraper_path)], 
                    env={
                        **os.environ,
                        "API_URL": "http://localhost:8000",  # Your FastAPI port
                        "OWNER_ID": "4"
                    })

@router.post("/start")
async def start_scraper(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_scraper)
    return {"message": "Scraper started"}

@router.get("/status")
async def scraper_status():
    # Implement status checking logic
    return {"status": "running"} 