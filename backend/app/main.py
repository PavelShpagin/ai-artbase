from fastapi import FastAPI
from database import Base, engine
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import models
from routers import arts, auth, categories

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

origins = [
    "http://localhost:5173",
    # "https://mydomain.com", #production domain
]

app.mount("/images", StaticFiles(directory="../images"), name="images")
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




