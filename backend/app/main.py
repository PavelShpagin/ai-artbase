from fastapi import FastAPI
from .database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from . import models
from .routers import arts, auth, categories
import uvicorn

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "http://localhost:5173",
    # "https://mydomain.com", #production domain
]

app.mount("/images", StaticFiles(directory="./images"), name="images")
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

from .chroma_services import *

print(collection_prompts.count())

#if __name__ == "__main__":
#    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)

