from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, Body, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import case, func, text, exists, and_, literal, select
from .. import schemas, models
from typing import List, Optional
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
import time
from app.scripts.enhance_prompts import generate_description

router = APIRouter()

@router.post("/arts/", response_model=schemas.Art)
async def create_art(prompt: str = Form(...), image: UploadFile = File(...), owner_id: int = Form(...), db: Session = Depends(get_db)): 
    # Validate owner_id exists
    user = db.query(models.User).filter(models.User.id == owner_id).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail=f"User with id {owner_id} does not exist"
        )

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
    
    # Initialize descriptive_prompt with original prompt
    descriptive_prompt = prompt
    
    # Generate descriptive prompt using Gemini
    try:
        # Generate descriptive keywords for the image
        generated_prompt = await generate_description(image_url, prompt, model='gemini')
        if generated_prompt:
            descriptive_prompt = generated_prompt
    except Exception as e:
        # Log the error but continue with original prompt
        print(f"Error generating descriptive prompt: {str(e)}")

    # Store the R2 URL in the database
    db_art = models.Art(
        width=width, 
        height=height, 
        prompt=prompt, 
        descriptive_prompt=descriptive_prompt, 
        src=image_url, 
        owner_id=owner_id
    )
    
    try:
        db.add(db_art)
        db.commit()
        db.refresh(db_art)

        # Add to ChromaDB
        collection_prompts.add(
            documents=[descriptive_prompt],
            ids=[str(db_art.id)]
        )

        # Add categories
        results = collection_categories.query(query_texts=[prompt], include=["distances", "documents"])
        filtered_ids = filter_chroma(results, 0.35)

        if filtered_ids:
            associations = [{"art_id": db_art.id, "category_id": category_id} for category_id in filtered_ids]
            db.execute(models.art_categories.insert(), associations)
            db.commit()

        return db_art
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create art entry: {str(e)}")

@router.get("/arts/", response_model=List[schemas.Art])
async def read_arts(limit: int = 1000, viewer_id: Optional[int] = None, db: Session = Depends(get_db)):
    current_time_seconds = int(time.time() / 3600)
    time_offset = current_time_seconds % 20000
    
    if viewer_id is not None:
        # Query arts with liked_by_user information
        arts = db.query(
            models.Art,
            exists().where(
                and_(
                    models.Like.art_id == models.Art.id,
                    models.Like.user_id == viewer_id
                )
            ).label('liked_by_user')
        ).offset(time_offset).limit(limit).all()
    else:
        # Query arts without liked_by_user information
        arts = db.query(
            models.Art,
            literal(False).label('liked_by_user')
        ).offset(time_offset).limit(limit).all()

    # Transform the results into the expected format
    arts_with_likes = [
        {
            **art.__dict__,
            "liked_by_user": liked_by_user
        }
        for art, liked_by_user in arts
    ]
    return arts_with_likes

@router.get("/search/", response_model=List[schemas.Art])
async def search_arts(query: str, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    results = collection_prompts.query(query_texts=[query], include=["distances"], n_results=100)  
    filtered_ids = results['ids'][0]
    
    if not filtered_ids:
        return []
    
    # Create a case statement for ordering results according to ChromaDB ranking
    order_case = case({id_: index for index, id_ in enumerate(filtered_ids)}, value=models.Art.id)
    
    if user_id is not None:
    # Query arts with liked_by_user information in a single query
        arts = db.query(
            models.Art,
            exists().where(
                and_(
                    models.Like.art_id == models.Art.id,
                    models.Like.user_id == user_id
                )
            ).label('liked_by_user')
        ).filter(models.Art.id.in_(filtered_ids)).order_by(order_case).all()
    else:
        # Query arts without liked_by_user information
        arts = db.query(
            models.Art,
            literal(False).label('liked_by_user')
        ).filter(models.Art.id.in_(filtered_ids)).order_by(order_case).all()
    
    # Transform the results into the expected format
    arts_with_likes = [
        {
            **art.__dict__,
            "liked_by_user": liked_by_user if user_id is not None else False
        }
        for art, liked_by_user in arts
    ]
    
    return arts_with_likes

@router.get("/arts/dates/", response_model=List[str])
async def read_art_dates(db: Session = Depends(get_db)):
    art_dates = db.query(models.Art.date).all()
    dates = [art_date[0].strftime("%Y-%m-%d %H:%M:%S") for art_date in art_dates]
    return dates

@router.get("/arts/{user_id}", response_model=List[schemas.Art])
def get_user_arts(user_id: int, viewer_id: Optional[int] = None, limit: int = 1000, db: Session = Depends(get_db)):
    arts = db.query(models.Art).filter(models.Art.owner_id == user_id).limit(limit).all()
    # Query arts with liked_by_user information in a single query
    if viewer_id is not None:
        arts_with_likes = db.query(
            models.Art,
            exists().where(
                and_(
                    models.Like.art_id == models.Art.id,
                    models.Like.user_id == viewer_id
                )
            ).label('liked_by_user')
        ).filter(models.Art.id.in_([art.id for art in arts])).all()
        
        arts_with_likes = [
            {
                **art.__dict__,
                "liked_by_user": liked_by_user
            }
            for art, liked_by_user in arts_with_likes
        ]
    else:
        # Query arts without liked_by_user information
        arts_with_likes = [
            {
                **art.__dict__,
                "liked_by_user": False
            }
            for art in arts
        ]
    return arts_with_likes

@router.get("/arts/similar/{art_id}", response_model=List[schemas.Art])
async def get_similar_arts(art_id: int, viewer_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Get semantically similar arts based on prompt embedding"""
    source_art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not source_art:
        raise HTTPException(status_code=404, detail="Art not found")
    
    prompt = source_art.descriptive_prompt
    
    if not prompt:
        # If no prompt, return random arts with like status
        if viewer_id is not None:
            arts_query = db.query(
                models.Art,
                exists().where(
                    and_(
                        models.Like.art_id == models.Art.id,
                        models.Like.user_id == viewer_id
                    )
                ).label('liked_by_user')
            ).filter(models.Art.id != art_id).limit(20)
        else:
            arts_query = db.query(
                models.Art,
                literal(False).label('liked_by_user')
            ).filter(models.Art.id != art_id).limit(20)
            
        arts_result = arts_query.all()
        
        return [
            {**art.__dict__, "liked_by_user": liked_by_user}
            for art, liked_by_user in arts_result
        ]

    try:
        results = collection_prompts.query(
            query_texts=[prompt],
            n_results=50,
            include=["documents", "distances", "metadatas"]
        )
        
        similar_ids = [int(id) for id in results['ids'][0] if int(id) != art_id] # Exclude the source art itself
        
        if not similar_ids:
            return []

        # Query similar arts with like status
        if viewer_id is not None:
            arts_query = db.query(
                models.Art,
                exists().where(
                    and_(
                        models.Like.art_id == models.Art.id,
                        models.Like.user_id == viewer_id
                    )
                ).label('liked_by_user')
            ).filter(models.Art.id.in_(similar_ids))
        else:
            arts_query = db.query(
                models.Art,
                literal(False).label('liked_by_user')
            ).filter(models.Art.id.in_(similar_ids))
            
        # Preserve ChromaDB order if needed (requires adjusting the query)
        # For simplicity, current implementation doesn't preserve ChromaDB order
        # If order preservation is crucial, we'd need a CASE statement like in search_arts
        arts_result = arts_query.all() 
        
        return [
            {**art.__dict__, "liked_by_user": liked_by_user}
            for art, liked_by_user in arts_result
        ]
      
    except Exception as e:
        print(f"ChromaDB query or subsequent database query failed: {str(e)}")
        # Fallback to random arts with like status
        if viewer_id is not None:
            arts_query = db.query(
                models.Art,
                exists().where(
                    and_(
                        models.Like.art_id == models.Art.id,
                        models.Like.user_id == viewer_id
                    )
                ).label('liked_by_user')
            ).filter(models.Art.id != art_id).limit(20)
        else:
            arts_query = db.query(
                models.Art,
                literal(False).label('liked_by_user')
            ).filter(models.Art.id != art_id).limit(20)
            
        arts_result = arts_query.all()
        
        return [
            {**art.__dict__, "liked_by_user": liked_by_user}
            for art, liked_by_user in arts_result
        ]

@router.get("/arts/id/{art_id}", response_model=schemas.Art)
async def get_art_by_id(art_id: int, db: Session = Depends(get_db)):
    art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")
    return art

@router.post("/arts/like/{art_id}")
async def like_unlike_art(art_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")

    if user_id is not None:
        # Check if the user has already liked the art
        like = db.query(models.Like).filter(models.Like.user_id == user_id, models.Like.art_id == art_id).first()
        if like:
            # Unlike the art
            db.delete(like)
            art.num_likes = max(0, art.num_likes - 1)  # Ensure likes do not go below zero
        else:
            # Like the art
            new_like = models.Like(user_id=user_id, art_id=art_id)
            db.add(new_like)
            art.num_likes += 1
    else:
        # Increment likes without user_id
        art.num_likes += 1

    db.commit()
    db.refresh(art)
    return {"art_id": art_id, "num_likes": art.num_likes}

@router.post("/arts/unlike/{art_id}")
async def unlike_art(art_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")

    # Decrement likes without user_id
    if user_id is not None:
        # Check if the user has already liked the art
        like = db.query(models.Like).filter(models.Like.user_id == user_id, models.Like.art_id == art_id).first()
        if like:
            # Unlike the art
            db.delete(like)
            art.num_likes = max(0, art.num_likes - 1)  # Ensure likes do not go below zero

    db.commit()
    db.refresh(art)
    return {"art_id": art_id, "num_likes": art.num_likes}

@router.get("/arts/likes/{user_id}", response_model=List[schemas.Art])
async def get_user_liked_arts(user_id: int, viewer_id: Optional[int] = None, limit: int = 1000, db: Session = Depends(get_db)):
    """Get all arts that a user has liked, sorted by art ID"""
    # Find all like objects for this user
    liked_art_ids = db.query(models.Like.art_id).filter(models.Like.user_id == user_id).all()
    
    # Extract the art_ids from the query results
    art_ids = [art_id for (art_id,) in liked_art_ids]
    
    if not art_ids:
        return []
    
    # Get all the arts that the user liked, ordered by art ID, along with viewer's like status
    if viewer_id is not None:
        arts_query = db.query(
            models.Art,
            exists().where(
                and_(
                    models.Like.art_id == models.Art.id,
                    models.Like.user_id == viewer_id
                )
            ).label('liked_by_user')
        ).filter(models.Art.id.in_(art_ids)).order_by(models.Art.id).limit(limit)
    else:
        # If no viewer_id, liked_by_user is always False (unless viewer_id matches user_id, handled implicitly)
        arts_query = db.query(
            models.Art,
             # Determine liked_by_user based on whether viewer_id matches the user_id whose likes we are fetching
            (models.Like.user_id == viewer_id if viewer_id is not None else literal(False)).label('liked_by_user')
        ).outerjoin(models.Like, and_(models.Like.art_id == models.Art.id, models.Like.user_id == viewer_id)) \
         .filter(models.Art.id.in_(art_ids)).order_by(models.Art.id).limit(limit)
         
    arts_result = arts_query.all()

    # Include the "liked_by_user" flag in the response
    arts_with_likes = [
        {
            **art.__dict__,
            "liked_by_user": liked_by_user
        }
        for art, liked_by_user in arts_result
    ]
    
    return arts_with_likes

@router.post("/arts/batch/", response_model=List[schemas.Art])
async def get_batch_arts(
    art_ids: List[int] = Body(..., embed=True),  # Expect a JSON body like { "art_ids": [1,2,3] }
    viewer_id: Optional[int] = Query(None),       # viewer_id passed as a query parameter
    db: Session = Depends(get_db)
):
    """Get full art objects with liked_by_user field for a batch of art IDs"""
    if not art_ids:
        return []
    
    # Query all arts in one database call
    arts = db.query(models.Art).filter(models.Art.id.in_(art_ids)).all()
    
    # If viewer_id is provided, get all likes by this user for these arts in one query
    user_likes = set()
    if viewer_id is not None:
        likes = db.query(models.Like).filter(
            models.Like.user_id == viewer_id,
            models.Like.art_id.in_(art_ids)
        ).all()
        user_likes = {like.art_id for like in likes}
    
    # Create a dictionary for fast lookup by ID
    art_dict = {art.id: art for art in arts}
    
    # Prepare the response in the same order as the input art_ids
    arts_with_likes = [
        {
            **art_dict[art_id].__dict__,
            "liked_by_user": art_id in user_likes
        }
        for art_id in art_ids if art_id in art_dict  # Only include IDs that were found
    ]
    
    return arts_with_likes
    
