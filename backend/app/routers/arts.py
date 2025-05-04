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
from ..r2_storage import upload_image_to_r2, upload_image_bytes_to_r2
from ..chroma_services import collection_prompts
import numpy as np
import time
from app.scripts.enhance_prompts import generate_description
import os
import logging # Add logging import
import json # Potentially needed if reading a JSON string from env var
from google.oauth2 import service_account
from google.auth import exceptions as auth_exceptions # For catching errors

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

logger.info("Attempting to initialize Vertex AI from environment variables...")

try:
    # Read necessary fields from environment variables
    # CAUTION: Handling the multi-line private key from an env var is tricky!
    # It might need specific escaping or base64 decoding depending on how it was set.
    # Assuming the private key was set correctly preserving newlines:
    sa_info = {
        "type": os.getenv("GCP_SA_TYPE", "service_account"),
        "project_id": os.getenv("GCP_SA_PROJECT_ID"),
        "private_key_id": os.getenv("GCP_SA_PRIVATE_KEY_ID"),
        "private_key": os.getenv("GCP_SA_PRIVATE_KEY").replace('\\n', '\n'), # Example fixup
        "client_email": os.getenv("GCP_SA_CLIENT_EMAIL"),
        "client_id": os.getenv("GCP_SA_CLIENT_ID"),
        "auth_uri": os.getenv("GCP_SA_AUTH_URI", "https://accounts.google.com/o/oauth2/auth"),
        "token_uri": os.getenv("GCP_SA_TOKEN_URI", "https://oauth2.googleapis.com/token"),
        "auth_provider_x509_cert_url": os.getenv("GCP_SA_AUTH_PROVIDER_URL", "https://www.googleapis.com/oauth2/v1/certs"),
        "client_x509_cert_url": os.getenv("GCP_SA_CLIENT_CERT_URL"),
        "universe_domain": "googleapis.com"
        # Add other fields if necessary
    }

    # Validate that essential fields were loaded
    if not all([sa_info["project_id"], sa_info["private_key"], sa_info["client_email"]]):
         raise ValueError("Missing essential GCP service account environment variables.")

    # Create credentials directly from the info dictionary
    credentials = service_account.Credentials.from_service_account_info(sa_info)
    logger.info(f"Created service account credentials for project '{sa_info['project_id']}'.")

    # Now initialize Vertex AI using these explicit credentials
    import vertexai
    from vertexai.preview.vision_models import ImageGenerationModel

    PROJECT_ID = sa_info["project_id"] # Use project_id from credentials
    LOCATION = os.getenv("GCP_LOCATION", "us-central1") # Still need location

    logger.info(f"Initializing Vertex AI for project '{PROJECT_ID}' in location '{LOCATION}' with explicit credentials...")
    vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
    logger.info("Vertex AI initialized. Loading model...")

    generation_model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
    logger.info(f"Vertex AI ImageGenerationModel loaded successfully from {LOCATION} for project {PROJECT_ID}")


except (auth_exceptions.GoogleAuthError, ValueError, Exception) as e:
    logger.error(f"Error initializing Vertex AI or loading model from env vars: {e}", exc_info=True)
    generation_model = None

logger.info(f"Vertex AI initialization finished. generation_model is set: {generation_model is not None}") # Added log

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
    
    # Generate descriptive prompt using the imported function (if needed)
    # This assumes generate_description uses the correct library/method now
    try:
        # Generate descriptive keywords for the image
        # Ensure generate_description is adapted if it also used the old genai client
        generated_prompt = await generate_description(image_url, prompt, model='gemini') # Or adjust model='vertexai' if needed
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
    time_offset = current_time_seconds % 800
    
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
        ).join(
            models.ArtMetadata, 
            models.ArtMetadata.art_id == models.Art.id
        ).filter(
            models.ArtMetadata.upvotes >= 25
        ).offset(time_offset).limit(limit).all()
    else:
        # Query arts without liked_by_user information
        arts = db.query(
            models.Art,
            literal(False).label('liked_by_user')
        ).join(
            models.ArtMetadata, 
            models.ArtMetadata.art_id == models.Art.id
        ).filter(
            models.ArtMetadata.upvotes >= 20
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
    arts = db.query(models.Art).filter(models.Art.owner_id == user_id).order_by(models.Art.date.desc()).limit(limit).all()
    # Query arts with liked_by_user information in a single query
    if viewer_id is not None:
        arts_with_likes_data = db.query(
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
            for art, liked_by_user in arts_with_likes_data
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
        # Increment likes without user_id - Consider if this logic is intended
        art.num_likes += 1 # Removed redundant check, just increment if no user_id

    db.commit()
    db.refresh(art)
    return {"art_id": art_id, "num_likes": art.num_likes}

@router.post("/arts/unlike/{art_id}")
async def unlike_art(art_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    art = db.query(models.Art).filter(models.Art.id == art_id).first()
    if not art:
        raise HTTPException(status_code=404, detail="Art not found")

    # Only decrement likes if user_id is provided and the like exists
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
        ).filter(models.Art.id.in_(art_ids)).order_by(models.Art.id).limit(limit) # Removed redundant outer join
    else:
        # If no viewer_id, liked_by_user is always False
        arts_query = db.query(
            models.Art,
             literal(False).label('liked_by_user') # Simpler: If no viewer_id, they haven't liked it
        ).filter(models.Art.id.in_(art_ids)).order_by(models.Art.id).limit(limit)
         
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

@router.post("/generate/image/", response_model=schemas.ImageGenerationResponse)
async def generate_image_from_prompt(
    request: schemas.ImageGenerationRequest,
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    if not generation_model: # Check if the Vertex AI model was initialized
        raise HTTPException(status_code=503, detail="Image generation service model is not available.")

    try:
        print(f"Generating image with prompt: {request.prompt}, count: {request.number_of_images}")
        # API call using the Vertex AI model instance
        response: ImageGenerationResponse = generation_model.generate_images(
            prompt=request.prompt,
            number_of_images=request.number_of_images,
        )

    except AttributeError as ae:
        print(f"AttributeError during API call: model object or response structure error. Error: {ae}")
        raise HTTPException(status_code=500, detail=f"API structure error: {ae}")
    except Exception as e:
        print(f"Error calling Vertex AI Imagen API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

    image_urls = []
    if not hasattr(response, 'images') or not response.images:
         print(f"Warning: No images found in the response from Vertex AI.")
         raise HTTPException(status_code=500, detail="Image generation call succeeded but returned no images.")

    for i, generated_image in enumerate(response.images):
        try:
            image_bytes = generated_image._image_bytes # Common pattern, verify with SDK docs

            if not image_bytes:
                print(f"Warning: Generated image {i} has no image bytes.")
                continue

            # --- Get image dimensions ---
            try:
                with Image.open(io.BytesIO(image_bytes)) as img:
                    width, height = img.size
            except Exception as img_err:
                print(f"Warning: Could not read dimensions for generated image {i}. Error: {img_err}")
                width, height = 0, 0 # Assign default or skip? Skipping might be safer.

            prompt_hash = hashlib.md5(request.prompt.encode()).hexdigest()
            # Use PNG for generated images, adjust if necessary
            unique_filename = f"generated_{prompt_hash}_{i}.png"
            content_type = 'image/png'

            image_url = await upload_image_bytes_to_r2(image_bytes, unique_filename, content_type=content_type)
            image_urls.append(image_url)
            print(f"Uploaded generated image to: {image_url}")

            # --- Create Art and GeneratedArt records if user_id is provided ---
            if user_id is not None and width > 0 and height > 0: # Only proceed if user_id and valid dimensions exist
                try:
                    # Create Art record
                    db_art = models.Art(
                        width=width,
                        height=height,
                        prompt=request.prompt,
                        # descriptive_prompt could potentially be generated here too
                        src=image_url,
                        owner_id=user_id
                    )
                    db.add(db_art)
                    db.flush() # Flush to get the db_art.id before creating GeneratedArt

                    # Create GeneratedArt record
                    generated_art_link = models.GeneratedArt(
                        user_id=user_id,
                        art_id=db_art.id
                    )
                    db.add(generated_art_link)

                    # Commit both records together
                    db.commit()
                    db.refresh(db_art) # Optional: refresh if needed later
                    print(f"Created Art record (ID: {db_art.id}) and GeneratedArt link for user {user_id}.")

                except Exception as db_err:
                    db.rollback() # Rollback if any DB operation fails
                    print(f"Error creating database records for generated image {i} (User: {user_id}): {db_err}")
                    # Decide how to handle: continue without DB record? Raise error?
                    # For now, we just log the error and continue, the URL is still added to the response.

            # --- End record creation ---

        except AttributeError as ae:
            print(f"Warning: Generated image {i} structure unexpected or missing data (_image_bytes attribute?). Error: {ae}")
            continue
        except Exception as e:
            print(f"Failed to process or upload generated image {i} to R2: {str(e)}")
            continue # Try next image if one fails

    if not image_urls:
        raise HTTPException(status_code=500, detail="Image generation succeeded but failed to process or upload any images.")

    # Return the original response schema
    return schemas.ImageGenerationResponse(image_urls=image_urls)
    

@router.get("/arts/generated/{user_id}", response_model=List[schemas.Art])
async def get_user_generated_arts(
    user_id: int,
    viewer_id: Optional[int] = None,
    limit: int = 1000,
    db: Session = Depends(get_db)
):
    """
    Get all arts that a user has generated (via GeneratedArt), sorted by creation time.
    """
    # Find all generated art IDs for this user
    generated_art_ids = db.query(models.GeneratedArt.art_id).filter(models.GeneratedArt.user_id == user_id).order_by(models.GeneratedArt.created_at.desc()).limit(limit).all()
    art_ids = [art_id for (art_id,) in generated_art_ids]

    if not art_ids:
        return []

    # Get all the arts that the user generated, along with viewer's like status
    if viewer_id is not None:
        arts_query = db.query(
            models.Art,
            exists().where(
                and_(
                    models.Like.art_id == models.Art.id,
                    models.Like.user_id == viewer_id
                )
            ).label('liked_by_user')
        ).filter(models.Art.id.in_(art_ids)).order_by(models.Art.id.desc()).limit(limit)
    else:
        arts_query = db.query(
            models.Art,
            literal(False).label('liked_by_user')
        ).filter(models.Art.id.in_(art_ids)).order_by(models.Art.id.desc()).limit(limit)

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