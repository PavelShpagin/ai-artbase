from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models, schemas
from ..utils import get_db

router = APIRouter()

@router.post("/art_metadata/", response_model=schemas.ArtMetadataSchema)
def create_art_metadata(art_id: int, neg_prompt_text: str = "", comments: str = "", upvotes: int = 0, db: Session = Depends(get_db)):
    # Check if art exists
    art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")
        
    # Check if metadata already exists for this art
    existing_metadata = db.query(models.ArtMetadata).filter(
        models.ArtMetadata.art_id == art_id
    ).first()
    
    if existing_metadata:
        # Update existing metadata
        existing_metadata.neg_prompt_text = neg_prompt_text
        existing_metadata.comments = comments
        existing_metadata.upvotes = upvotes
        db.commit()
        db.refresh(existing_metadata)
        return existing_metadata
    else:
        # Create new metadata
        db_metadata = models.ArtMetadata(
            art_id=art_id,
            neg_prompt_text=neg_prompt_text,
            comments=comments,
            upvotes=upvotes
        )
        db.add(db_metadata)
        db.commit()
        db.refresh(db_metadata)
        return db_metadata 