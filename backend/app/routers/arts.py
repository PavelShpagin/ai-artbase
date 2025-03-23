from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from .. import schemas, models
from typing import List
import uuid
from PIL import Image
import io
import hashlib
from ..chroma_services import *
from ..config import *
from ..utils import *
from ..r2_storage import upload_image_to_r2
from ..chroma_services import collection_prompts
import numpy as np

router = APIRouter()

@router.post("/arts/", response_model=schemas.Art)
async def create_art(prompt: str = Form(...), image: UploadFile = File(...), owner_id: int = Form(...), db: Session = Depends(get_db)): 
    # Read image data
    image_data = await image.read()
    image.file.seek(0)  # Reset file pointer
    
    # Generate hash from image data
    image_hash = hashlib.md5(image_data).hexdigest()
    file_extension = image.filename.split(".")[-1]
    unique_filename = f"{image_hash}.{file_extension}"
    
    # Get image dimensions
    with Image.open(io.BytesIO(image_data)) as img:
        width, height = img.size
    
    # Upload to R2 instead of saving locally
    try:
        image_url = await upload_image_to_r2(image, unique_filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image to R2: {str(e)}")
    
    # Store the R2 URL in the database
    db_art = models.Art(width=width, height=height, prompt=prompt, src=image_url, owner_id=owner_id)
    db.add(db_art)
    db.commit()
    db.refresh(db_art)

    collection_prompts.add(
        documents=[prompt],
        ids=[str(db_art.id)]
    )

    results = collection_categories.query(query_texts=[prompt], include=["distances", "documents"])
    filtered_ids = filter_chroma(results, 0.35)

    if(filtered_ids):
        associations = [{"art_id": db_art.id, "category_id": category_id} for category_id in filtered_ids]
        db.execute(models.art_categories.insert(), associations)
        db.commit()

    return db_art

@router.get("/arts/", response_model=List[schemas.Art])
async def read_arts(limit: int = 1000, db: Session = Depends(get_db)):
    arts = db.query(models.Art).order_by(func.random()).limit(limit).all()
    return arts

@router.get("/search/", response_model=List[schemas.Art])
async def search_arts(query: str, db: Session = Depends(get_db)):
    results = collection_prompts.query(query_texts=[query], include=["distances"])  
    print(results)
    filtered_ids = results['ids'][0]# filter_chroma(results, 0.4)
    
    if not filtered_ids:
        return []
    order_case = case({id_: index for index, id_ in enumerate(filtered_ids)}, value=models.Art.id)
    arts = db.query(models.Art).filter(models.Art.id.in_(filtered_ids)).order_by(order_case).all()
    
    return arts

@router.get("/arts/dates/", response_model=List[str])
async def read_art_dates(db: Session = Depends(get_db)):
    art_dates = db.query(models.Art.date).all()
    dates = [art_date[0].strftime("%Y-%m-%d %H:%M:%S") for art_date in art_dates]
    return dates

@router.get("/arts/{user_id}", response_model=List[schemas.Art])
def get_user_arts(user_id: int, db: Session = Depends(get_db)):
    arts = db.query(models.Art).filter(models.Art.owner_id == user_id).all()
    if not arts:
        raise HTTPException(status_code=404, detail="No arts found for this user.")
    return arts

@router.get("/arts/similar/{art_id}", response_model=List[schemas.Art])
async def get_similar_arts(art_id: int, db: Session = Depends(get_db)):
    """Get semantically similar arts based on prompt embedding"""
    # Fetch the source art
    source_art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not source_art:
        raise HTTPException(status_code=404, detail="Art not found")
    
    # Get the prompt from the source art
    prompt = source_art.prompt
    if not prompt:
        # If no prompt, return random arts
        arts = db.query(models.Art).filter(models.Art.id != art_id).limit(20).all()
        return arts
    
    # Query ChromaDB for similar prompts
    try:
        results = collection_prompts.query(
            query_texts=[prompt],
            n_results=50,
            include=["documents", "distances", "metadatas"]
        )
        
        similar_ids = results['ids'][0]
        similar_arts = db.query(models.Art)\
            .filter(models.Art.id.in_(similar_ids))\
            .all()
            
        return similar_arts
      
    
    except Exception as e:
        # Fallback to random arts if ChromaDB query fails
        print(f"ChromaDB query failed: {str(e)}")
        arts = db.query(models.Art).filter(models.Art.id != art_id).limit(20).all()
        return arts