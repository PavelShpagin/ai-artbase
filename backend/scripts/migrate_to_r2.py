#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Add the backend directory to Python path so we can import from app
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent

# Add backend directory to Python path
sys.path.append(str(BACKEND_DIR))

import boto3
from sqlalchemy import create_engine, text
import mimetypes
from tqdm import tqdm

# Now we can import from app
from app.config import (
    URL_DATABASE, 
    R2_ACCESS_KEY_ID, 
    R2_SECRET_ACCESS_KEY, 
    R2_ENDPOINT_URL, 
    R2_BUCKET_NAME,
    R2_PUBLIC_URL
)

# Initialize R2 client
r2_client = boto3.client(
    's3',
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    endpoint_url=R2_ENDPOINT_URL
)

# Initialize database connection
engine = create_engine(URL_DATABASE)

def get_image_paths():
    """Get all image paths from the local images directory"""
    image_dir = BACKEND_DIR / "images"
    return list(image_dir.glob("*"))

def get_mime_type(file_path):
    """Determine the MIME type of a file"""
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return mime_type or 'application/octet-stream'

def get_r2_url(filename):
    """Generate the R2 URL for a file"""
    # Use custom domain directly without bucket name
    return f"{R2_PUBLIC_URL}/{filename}"

def upload_to_r2(file_path):
    """Upload a file to R2"""
    filename = file_path.name
    mime_type = get_mime_type(file_path)
    
    try:
        with open(file_path, 'rb') as file_data:
            r2_client.upload_fileobj(
                file_data,
                R2_BUCKET_NAME,
                filename,
                ExtraArgs={"ContentType": mime_type}
            )
        return True
    except Exception as e:
        print(f"Error uploading {filename}: {e}")
        return False

def get_db_images():
    """Get all image records from the database"""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, src FROM arts"))
        return {row[1].split('/')[-1]: row for row in result}

def update_db_urls(db_images, uploaded_files):
    """Update database URLs for uploaded files and delete records for missing images"""
    updates = []
    deletions = []
    
    # Process image paths
    for file_path in uploaded_files:
        filename = file_path.name
        if filename in db_images:
            new_url = get_r2_url(filename)
            updates.append((new_url, db_images[filename][0]))
    
    # Find missing images
    local_filenames = {file_path.name for file_path in uploaded_files}
    for db_filename, (art_id, _) in db_images.items():
        if db_filename not in local_filenames:
            deletions.append(art_id)
    
    with engine.begin() as conn:
        # Update URLs
        if updates:
            print(f"Updating {len(updates)} image URLs in database...")
            for new_url, art_id in updates:
                conn.execute(
                    text("UPDATE arts SET src = :new_url WHERE id = :art_id"),
                    {"new_url": new_url, "art_id": art_id}
                )
        
        # Delete missing image records with cascade
        if deletions:
            print(f"Deleting {len(deletions)} records for missing images...")
            for art_id in deletions:
                # Delete related records first for proper cascading
                conn.execute(
                    text("DELETE FROM art_categories WHERE art_id = :art_id"),
                    {"art_id": art_id}
                )

                conn.execute(
                    text("DELETE FROM art_metadata WHERE art_id = :art_id"), 
                    {"art_id": art_id}
                )
                # You might need to add more related tables here if they exist
                
                # Finally delete the art record
                conn.execute(
                    text("DELETE FROM arts WHERE id = :art_id"),
                    {"art_id": art_id}
                )
    
    print(f"Updated {len(updates)} URLs and deleted {len(deletions)} records.")

def main():
    print("Starting R2 migration process...")
    
    # Get all local image paths
    image_paths = get_image_paths()
    print(f"Found {len(image_paths)} local images.")
    
    # Get all database images
    db_images = get_db_images()
    print(f"Found {len(db_images)} images in database.")

    # Upload images to R2
    print("Uploading images to R2...")
    uploaded_files = []
    
    for image_path in tqdm(image_paths, desc="Uploading"):
        if upload_to_r2(image_path):
            uploaded_files.append(image_path)
    
    print(f"Successfully uploaded {len(uploaded_files)} images to R2.")
    
    # Update database URLs and handle missing images
    update_db_urls(db_images, uploaded_files)
    
    print("Migration completed!")

if __name__ == "__main__":
    main()
