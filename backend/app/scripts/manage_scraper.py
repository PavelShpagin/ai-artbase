#!/usr/bin/env python
import sys
from pathlib import Path
import subprocess
import os

SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
SCRAPER_PATH = BACKEND_DIR.parent / "scraper" / "civitai-scraper.js"

def start_scraper():
    env = os.environ.copy() 
    subprocess.Popen(["node", str(SCRAPER_PATH)], env=env)
    print("Scraper started")
    
def stop_scraper():
    try:
        # Find the process ID of the scraper
        result = subprocess.run(["pgrep", "-f", "civitai-scraper.js"], capture_output=True, text=True)
        pids = result.stdout.strip().split("\n")
        
        if not pids or pids == ['']:
            print("No scraper process found.")
            return
        
        # Kill the scraper process
        for pid in pids:
            subprocess.run(["kill", pid])
            print(f"Scraper process {pid} stopped.")
    except Exception as e:
        print(f"An error occurred while stopping the scraper: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python manage_scraper.py [start|stop]")
        sys.exit(1)

    command = sys.argv[1]
    if command == "start":
        start_scraper()
    elif command == "stop":
        stop_scraper()
    else:
        print(f"Unknown command: {command}") 