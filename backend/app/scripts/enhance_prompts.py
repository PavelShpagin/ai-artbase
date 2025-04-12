#!/usr/bin/env python
import sys
from pathlib import Path
from tqdm import tqdm
import os
import tempfile
import google.generativeai as genai

# Add the backend directory to Python path
SCRIPT_DIR = Path(__file__).parent
BACKEND_DIR = SCRIPT_DIR.parent
sys.path.append(str(BACKEND_DIR))

from openai import AsyncOpenAI
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Art
from app.chroma_services import collection_prompts
from app.config import DATABASE_URL
import time
import requests
from PIL import Image
from io import BytesIO
import base64

# Initialize AsyncOpenAI client
client = AsyncOpenAI()

async def process_image_url(url: str, max_size=(384, 384)) -> str:
    """
    Download, process and save image from URL
    Returns the file path of the processed image
    """
    try:
        # Download image
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        # Open image and get size
        img = Image.open(BytesIO(response.content))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            
        # Create a temporary file regardless of size
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpeg")
        
        # Check if image needs resizing
        if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
            # Calculate new size maintaining aspect ratio
            ratio = min(max_size[0] / img.size[0], max_size[1] / img.size[1])
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            
            # Resize image
            img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Save the image (resized or original)
        img.save(temp_file, format="JPEG", quality=85)
        temp_file.close()
        
        # Return file path
        return temp_file.name
        
    except Exception as e:
        print(f"Error processing image {url}: {str(e)}")
        # Create a simple fallback image in case of download failure
        try:
            fallback_img = Image.new('RGB', (100, 100), color='gray')
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".jpeg")
            fallback_img.save(temp_file, format="JPEG")
            temp_file.close()
            return temp_file.name
        except Exception as fallback_error:
            print(f"Failed to create fallback image: {str(fallback_error)}")
            raise RuntimeError(f"Could not process image URL: {url}")

async def generate_description(url: str, original_prompt: str, max_retries=8, model='openai') -> str:
    retry_count = 0
    base_delay = 2
    
    # Process image first
    processed_image_path = await process_image_url(url)
    # print(f"Processed image: {url}")
    # print(f"Original prompt: {original_prompt}")
    
    if model == 'openai':
        # For OpenAI, use the API's usage statistics
        system_prompt = "Generate a list of comma-separated keywords that best describe unique features of the image. It should be search-optimized and concise. Focus on unique elements, artistic style, specific details, and meaningful keywords. Avoid generic terms and repetition. Format: concise but detailed list of comma-separated keywords. Don't add any other text, just keywords and unique features. Importantly, avoid common words, that are present in many images, only outline unique keywords that uniquely describe 90% of the image, omit niche details. Around 6-8 most unique short keywords is enough. Only keywords, no other text"
        
        while retry_count < max_retries:
            try:
                # Read the image file as binary data
                with open(processed_image_path, "rb") as image_file:
                    image_data = image_file.read()
                
                # Encode image to base64
                base64_image = base64.b64encode(image_data).decode('utf-8')
                
                response = await client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": system_prompt
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": f"Original prompt: {original_prompt}\nPlease decompose this image into keywords, focusing on unique elements."},
                                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                            ]
                        }
                    ],
                    max_tokens=300
                )
                
                # Log token usage from the API response
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                total_tokens = response.usage.total_tokens
                
                print(f"OpenAI API Token Usage:")
                print(f"  Input tokens: {input_tokens}")
                print(f"  Output tokens: {output_tokens}")
                print(f"  Total tokens: {total_tokens}")
                
                # Calculate cost (based on gpt-4o-mini pricing)
                input_cost = (input_tokens / 1000000) * 0.15  # $5 per 1M input tokens
                output_cost = (output_tokens / 1000000) * 0.6  # $15 per 1M output tokens
                total_cost = input_cost + output_cost
                
                print(f"  Estimated cost: ${total_cost:.6f}")
                
                return response.choices[0].message.content
                
            except Exception as e:
                error_message = str(e).lower()
                if "rate_limit" in error_message or "too_many_requests" in error_message:
                    retry_count += 1
                    if retry_count < max_retries:
                        delay = base_delay * (2 ** retry_count)
                        print(f"Rate limit hit, retrying in {delay} seconds... (Attempt {retry_count}/{max_retries})")
                        await asyncio.sleep(delay)
                        continue
                elif "file size" in error_message or "too large" in error_message:
                    print(f"Image size error for {url}, attempting with more aggressive compression")
                    # Try again with more aggressive compression
                    processed_image_path = await process_image_url(url, max_size=(512, 512))
                    continue
                else:
                    print(f"API error for URL {url}: {str(e)}")
                    return None
                
                if retry_count >= max_retries:
                    print(f"Max retries reached for URL {url}")
                    return None
    else:  # Default to Gemini
        # Similar implementation for Gemini, but with estimation since Gemini might
        # not provide explicit token usage information
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        
        def upload_to_gemini(path, mime_type=None):
            """Uploads the given file to Gemini."""
            file = genai.upload_file(path, mime_type=mime_type)
            # print(f"Uploaded file '{file.display_name}' as: {file.uri}")
            return file

        # Upload the image to Gemini
        file = upload_to_gemini(processed_image_path, mime_type="image/jpeg")

        # Estimate Gemini token usage based on file size and text length
        # This is an approximation and may not reflect actual token counts
        prompt_text = f"Original prompt: {original_prompt}\nPlease describe this image in detail, focusing on unique elements."
        
        # Get file size in KB as a proxy for image complexity
        try:
            image_size_kb = os.path.getsize(processed_image_path) / 1024
            # Rough estimation: assume 1KB = ~10 tokens for images
            estimated_image_tokens = int(image_size_kb * 10)
        except:
            estimated_image_tokens = 1000  # Default assumption if file size can't be determined
            
        # Roughly estimate text tokens (4 chars ≈ 1 token is a common approximation)
        estimated_text_tokens = len(prompt_text) // 4
        
        estimated_total_input = estimated_image_tokens + estimated_text_tokens
        
        # print(f"Gemini API Token Usage (Estimated):")
        # print(f"  Estimated image tokens: {estimated_image_tokens}")
        # print(f"  Estimated text tokens: {estimated_text_tokens}")
        # print(f"  Estimated total input tokens: {estimated_total_input}")

        # Create the model
        generation_config = {
            "temperature": 1,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
            "response_mime_type": "text/plain",
        }

        model = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            generation_config=generation_config,
        )

        chat_session = model.start_chat(
            history=[
                {
                    "role": "user",
                    "parts": [
                        file,
                        f"Original prompt: {original_prompt}\n\nGenerate a list of comma-separated keywords that best describe unique features of the image. If anything in the original prompt is completely not present in the image, ignore it. It should be search-optimized and concise. Focus on unique elements, artistic style, specific details, and meaningful keywords. Avoid generic terms and repetition. Format: concise but detailed list of comma-separated keywords. Don't add any other text, just keywords and unique features. Importantly, avoid common words, that are present in many images, only outline unique keywords that uniquely describe 90% of the image, omit niche details. Around 6-8 most unique short keywords is enough. Only keywords, no other text."
                    ],
                }
            ]
        )

        response = chat_session.send_message("Please provide the keywords for this image.")
        
        # Estimate output tokens
        estimated_output_tokens = len(response.text) // 4
        # print(f"  Estimated output tokens: {estimated_output_tokens}")

        return response.text

async def process_batch(session, arts, batch_size=3):
    # Create progress bar for total arts
    progress_bar = tqdm(total=len(arts), desc="Processing artworks")
    
    for i in range(0, len(arts), batch_size):
        batch = arts[i:i + batch_size]
        tasks = []
        
        for art in batch:
            if not art.descriptive_prompt:
                tasks.append((art, generate_description(art.src, art.prompt or "", model='gemini')))
        
        if tasks:
            for art, task in tasks:
                try:
                    description = await task
                    if description:
                        art.descriptive_prompt = description
                        
                        # Check if the ID exists before trying to delete it
                        # try:
                            # Use get to check if the ID exists
                            # print(f"collection_prompts: {collection_prompts.count()}")
                            # results = collection_prompts.get(
                            #     ids=[str(art.id)],
                            #     include=["metadatas"]
                            # )
                            
                            # if results['ids'] and str(art.id) in results['ids']:
                            #     print(f"Deleting ID {results} from database")
                            #     # Only delete if it exists
                            #     collection_prompts.delete(
                            #         ids=[str(art.id)]
                            #     )
                        # except Exception as e:
                            # If there's an error getting the ID, log it but continue
                        #    print(f"Error checking ID {art.id} in database: {str(e)}")
                        
                        # Add the new description with new embedding
                        collection_prompts.add(
                            ids=[str(art.id)],
                            documents=[description],
                            # metadatas=[{"art_id": art.id}]
                        )
                except Exception as e:
                    print(f"Error processing art ID {art.id}: {str(e)}")
            
            try:
                session.commit()
            except Exception as e:
                session.rollback()
                print(f"Error committing to database: {str(e)}")
            
            # Update progress bar by batch_size
            progress_bar.update(len(batch))
            await asyncio.sleep(5)
    
    # Close progress bar
    progress_bar.close()

async def main():
    # Database setup
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        # Declare global before using it
        # global collection_prompts
        
        # Reinitialize the prompts collection to fix nonexisting ID warnings
        try:
            print("Reinitializing collection_prompts to fix index issues...")
            # Get reference to the ChromaDB client and collection name
            # chroma_client = collection_prompts._client
            # collection_name = collection_prompts._name
            
            # # Store metadata and settings before deletion (if needed)
            # collection_metadata = collection_prompts.metadata
            
            # Delete the collection (this removes the problematic index)
            # chroma_client.delete_collection(collection_name)
            # print(f"Collection '{collection_name}' deleted successfully")
            
            # Recreate the collection with the same settings
            # collection_prompts = chroma_client.get_or_create_collection(
            #     name=collection_name,
            #     metadata=collection_metadata
            # )
            # print(f"Collection '{collection_name}' recreated successfully")
        except Exception as e:
            print(f"Error reinitializing collection: {str(e)}")
        
        # Get all arts (both with and without descriptive prompts)
        arts = session.query(Art).all()
        print(f"Found {len(arts)} total arts")
        
        # First, add all existing descriptive prompts to the collection
        # arts_with_prompts = [art for art in arts if art.descriptive_prompt]
        # print(f"Found {len(arts_with_prompts)} arts with existing descriptive prompts")
        
        # # Add existing descriptive prompts in batches to avoid overloading
        # batch_size = 100  # Adjust based on your system capabilities
        # for i in range(0, len(arts_with_prompts), batch_size):
        #     batch = arts_with_prompts[i:i+batch_size]
        #     try:
        #         # Add existing descriptive prompts to collection
        #         collection_prompts.add(
        #             ids=[str(art.id) for art in batch],
        #             documents=[art.descriptive_prompt for art in batch],
        #         )
        #         print(f"Added batch {i//batch_size + 1}/{(len(arts_with_prompts) + batch_size - 1)//batch_size} of existing prompts")
        #     except Exception as e:
        #         print(f"Error adding batch of existing prompts: {str(e)}")
            
        #     # Small delay to avoid overwhelming the database
        #     await asyncio.sleep(1)
        
        # Now process arts without descriptive prompts
        arts_without_prompts = [art for art in arts if not art.descriptive_prompt]
        print(f"Found {len(arts_without_prompts)} arts without descriptive prompts")
        
        # Process in batches using the existing function
        if arts_without_prompts:
            print("Processing arts without descriptive prompts...")
            await process_batch(session, arts_without_prompts)
        else:
            print("No arts without descriptive prompts to process")
            
    except Exception as e:
        print(f"Error in main process: {str(e)}")
    finally:
        session.rollback()
        session.close()

if __name__ == "__main__":
    asyncio.run(main())