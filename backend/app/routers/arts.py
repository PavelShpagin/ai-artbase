from fastapi import APIRouter, Depends, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import case, func
from .. import schemas, models
from typing import List
import shutil
import uuid
from PIL import Image
from ..chroma_services import *
from ..config import *
from ..utils import *

router = APIRouter()

@router.post("/arts/", response_model=schemas.Art)
async def create_art(prompt: str = Form(...), image: UploadFile = File(...), owner_id: int = Form(...), db: Session = Depends(get_db)): 
    file_extension = image.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    image_path = f"./images/{unique_filename}"

    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    image.file.seek(0)
    with Image.open(image.file) as img:
        width, height = img.size
    
    url_path = f"{IMAGE_BASE_URL}/{unique_filename}"
    db_art = models.Art(width=width, height=height, prompt=prompt, src=url_path, owner_id=owner_id)
    db.add(db_art)
    db.commit()
    db.refresh(db_art)

    collection_prompts.add(
        documents=[prompt],
        ids=[str(db_art.id)]
    )

    results = collection_categories.query(query_texts=[prompt], include=["distances", "documents"])
    print(results)
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
    
    filtered_ids = filter_chroma(results)
    
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