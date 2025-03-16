from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..utils import get_db

router = APIRouter()

@router.post("/processed_links/", response_model=schemas.ProcessedLink)
def create_processed_link(link_data: schemas.ProcessedLink, db: Session = Depends(get_db)):
    # Check if link already exists
    existing_link = db.query(models.ProcessedLink).filter(models.ProcessedLink.link == link_data.link).first()
    if existing_link:
        return existing_link
    
    # Create new link if it doesn't exist
    db_link = models.ProcessedLink(link=link_data.link)
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    return db_link

@router.get("/check_processed_link/")
def check_processed_link(link: str, db: Session = Depends(get_db)):
    db_link = db.query(models.ProcessedLink).filter(models.ProcessedLink.link == link).first()
    return {"processed": db_link is not None} 