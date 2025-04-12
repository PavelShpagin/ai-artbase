#!/usr/bin/env python
import sys
from pathlib import Path

# Add the backend directory to Python path
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.append(str(BACKEND_DIR))

from sqlalchemy import create_engine, text
from app.config import DATABASE_URL

def update_all_image_urls():
    """Update all image URLs in the database to use the custom domain format"""
    engine = create_engine(DATABASE_URL)
    
    # Get all arts with their URLs
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, src FROM arts"))
        arts = [(row[0], row[1]) for row in result]
    
    updates = []
    for art_id, old_url in arts:
        # Extract just the filename from the old URL
        filename = old_url.split('/')[-1]
        # Create new URL with the custom domain
        new_url = f"https://cdn.aiartbase.com/{filename}"
        updates.append((new_url, art_id))
    
    # Update all URLs in a separate transaction
    with engine.begin() as conn:
        for new_url, art_id in updates:
            conn.execute(
                text("UPDATE arts SET src = :new_url WHERE id = :art_id"),
                {"new_url": new_url, "art_id": art_id}
            )
    
    print(f"Updated {len(updates)} image URLs to use the custom domain.")

if __name__ == "__main__":
    print("Starting URL update process...")
    update_all_image_urls()
    print("URL update completed!") 