from fastapi import FastAPI
from .database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .routers import arts, auth, categories, users
from .database import SessionLocal
import shutil
import uuid
from PIL import Image
from pathlib import Path
import asyncio
from threading import Thread
import json

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "http://localhost:5173",
    "https://aiartbase.com", #production domain
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

app.include_router(arts.router)
app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(users.router)

from .chroma_services import *

print(collection_prompts.count())
print(collection_categories.count())

#chroma.delete("Prompts")

def insert_art(prompt: str, image_path: str, owner_id: int, comments: str = "", upvotes: int = 0, neg_prompt_text: str = ""):
    print(image_path)
    image_path = image_path.replace('\\', '/')
    if not Path(image_path).exists():
        print(f"File does not exist: {image_path}")
        return
    
    db = SessionLocal()
    prompt = prompt or ''
    image_path_obj = Path(image_path)
    file_extension = image_path_obj.suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    url_path = f"{IMAGE_BASE_URL}/{unique_filename}"

    try:
        target_path = os.path.join("images", unique_filename)
        shutil.copyfile(image_path, target_path)

        with Image.open(target_path) as img:
            width, height = img.size
        
        db_art = models.Art(prompt=prompt, width=width, height=height, src=url_path, owner_id=owner_id)
        db.add(db_art)
        db.commit()
        db.refresh(db_art)

        if comments or upvotes or neg_prompt_text:
            db_art_metadata = models.ArtMetadata(
                art_id=db_art.id, 
                comments=comments, 
                upvotes=upvotes, 
                neg_prompt_text=neg_prompt_text
            )
            db.add(db_art_metadata)
            db.commit()

        if(prompt != ''):
            print(prompt)
            collection_prompts.add(documents=[prompt], ids=[str(db_art.id)])
        
            results = collection_categories.query(query_texts=[prompt], include=["distances", "documents"])
            filtered_ids = filter_chroma(results, 0.45)
            
            if filtered_ids:
                associations = [{"art_id": db_art.id, "category_id": category_id} for category_id in filtered_ids]
                db.execute(models.art_categories.insert(), associations)
                db.commit()

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def check_for_json_files(directory: str):
    print("Adding data...")
    for filename in os.listdir(directory):
        if filename.endswith(".json"):
            file_path = os.path.join(directory, filename)
            with open(file_path, 'r', encoding='utf-8') as file:
                data = json.load(file)
                for item in data:
                    comments = item.get('Comments', "")
                    upvotes = item.get('Upvotes', "")
                    neg_prompt_text = item.get("NegPromptText", "")

                    insert_art(item['PromptText'], item['ImagePath'], 4, comments, upvotes, neg_prompt_text)
            os.remove(file_path)
    print("Finished!")

def main():
    directory = "C:/Users/Pavel/my-puppeteer-project/pageData123"
    check_for_json_files(directory)


def run_in_thread(fn):
    def run():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        fn()
    thread = Thread(target=run)
    thread.start()

'''
@app.on_event("startup")
def startup_event():
    run_in_thread(main)

'''



'''
# categories injection setup

from .models import Category
from sqlalchemy.orm import Session

def create_categories(db: Session, category_names: list):
    for name in category_names:
        category = Category(name=name)
        db.add(category)
        db.commit()
        db.refresh(category)
        
        collection_categories.add(
            documents=[name],
            ids=[str(category.id)]
        )

@app.on_event("startup")
async def startup_event():
    print(collection_prompts.count())
    db = SessionLocal()
    try:
        categories = [
    "Anime",
    "Fantasy",
    "Sci-Fi",
    "Space",
    "Cyberpunk",
    "Steampunk",
    "Underwater",
    "Apocalypse",
    "Virtual",
    "Alien",
    "Robots",
    "Futuristic",
    "Surreal",
    "Dreamscape",
    "Mythical",
    "Utopia",
    "Dystopia",
    "Interstellar",
    "Time",
    "Quantum",
    "AI",
    "Digital",
    "Augmented",
    "Forest",
    "Magical",
    "Neon",
    "Concept",
    "Character",
    "Creature",
    "Tech",
    "Horror",
    "Gothic",
    "Medieval",
    "Modern",
    "Impression",
    "Cubism",
    "Minimal",
    "Abstract",
    "Color",
    "Street",
    "Comic",
    "Manga",
    "Kawaii",
    "Pixel",
    "Glitch",
    "Fantastical",
    "Dramatic",
    "Mystic",
    "Galactic",
    "Cyberspace",
    "Mechanical",
    "Alternate",
    "Bio",
    "Organic",
    "Cosmic",
    "Psychedelic",
    "Vibrant",
    "Dynamic",
    "Fairy",
    "Mythology",
    "Legendary",
    "Ethereal",
    "Nostalgic",
    "Whimsical",
    "Magical Realism",
    "Supernatural",
    "Folklore",
    "Enigmatic",
    "Enchanted",
    "Epic",
    "Industrial",
    "Retro",
    "Punk",
    "Digitalism",
    "Cybernetic",
    "Abstracted",
    "Chromatic",
    "Visionary",
    "Ultramodern",
    "Spectral",
    "Luminous",
    "Exquisite",
    "Exotic",
    "Monochromatic",
    "Futurism",
    "Post-Apocalyptic",
    "Bio-mechanical",
    "Robotic",
    "Geomorphic",
    "Mythopoeic",
    "Eco-Futurism",
    "Post-Modern",
    "Techno",
    "Techno-organic",
    "Biopunk",
    "Dieselpunk",
    "Atompunk",
    "Clockwork",
    "Nuclear",
    "Nanotech",
    "Vivid",
    "Saturated",
    "Chimerical",
    "Dreamy",
    "Illusory",
    "Phantasmagorical",
    "Arcane",
    "Hypermodern",
    "Futurismic",
    "Neomodern",
    "Retrofuturist",
    "Holographic",
    "Nanoscopic",
    "Microscopic",
    "Macroscopic",
    "Nebulous",
    "Ambiguous",
    "Mysterious",
    "Cryptic",
    "Otherworldly",
    "Multidimensional",
    "Transcendent",
    "Metaphysical",
    "Gigantic",
    "Colossal",
    "Monumental",
    "Grandiose",
    "Majestic",
    "Stellar",
    "Celestial",
    "Planetary",
    "Intergalactic",
    "Universal"
]
        create_categories(db, categories)
    finally:
        db.close()'''