from openai import OpenAI
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from ..models import Art
from ..chroma_services import collection_prompts
from ..config import *
import time

# Initialize OpenAI client
client = OpenAI()  # Make sure to set your API key in environment variables

async def generate_description(url: str, original_prompt: str) -> str:
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Generate a detailed, search-optimized description of the image. Focus on unique elements, artistic style, specific details, and meaningful keywords. Avoid generic terms and repetition. Format: concise but detailed description."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Original prompt: {original_prompt}\nPlease describe this image in detail, focusing on unique elements:"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": url,
                            },
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error generating description for image {url}: {str(e)}")
        return None

async def process_batch(session, arts, batch_size=5):
    for i in range(0, len(arts), batch_size):
        batch = arts[i:i + batch_size]
        tasks = []
        
        for art in batch:
            if not art.descriptive_prompt:  # Only process if no descriptive prompt exists
                task = generate_description(art.src, art.prompt)
                tasks.append((art, task))
        
        if tasks:
            # Wait for all descriptions in batch to complete
            for art, task in tasks:
                try:
                    description = await task
                    if description:
                        # Update database
                        art.descriptive_prompt = description
                        
                        # Update ChromaDB
                        collection_prompts.update(
                            ids=[str(art.id)],
                            documents=[description]
                        )
                        
                        print(f"Updated art ID {art.id} with new description")
                    
                except Exception as e:
                    print(f"Error processing art ID {art.id}: {str(e)}")
            
            # Commit batch
            try:
                session.commit()
                print(f"Committed batch {i//batch_size + 1}")
            except Exception as e:
                session.rollback()
                print(f"Error committing batch: {str(e)}")
            
            # Rate limiting
            await asyncio.sleep(2)  # Adjust as needed based on API limits

async def main():
    # Database setup
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        # Get all arts
        arts = session.query(Art).all()
        print(f"Found {len(arts)} arts to process")
        
        # Process in batches
        # await process_batch(session, arts)
        msg = await generate_description(arts[0].src, arts[0].prompt)
        print(msg)

        
    except Exception as e:
        print(f"Error in main process: {str(e)}")
    finally:
        session.close()

if __name__ == "__main__":
    asyncio.run(main()) 