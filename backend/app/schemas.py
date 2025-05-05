from pydantic import BaseModel, Field
from typing import Optional, List, Union, Dict, Any
from datetime import datetime

#User
class UserBase(BaseModel):
    email: str
    username: Optional[str]

class UserCreate(UserBase):
    password: Optional[str]

class User(UserCreate):
    id: int
    picture: str = ""
    description: str =""
    hidden: bool = False
    premium: bool = False
    role: str = "user"
    
    class Config:
        orm_mode = True

# Art
class ArtBase(BaseModel):
    width: int
    height: int
    prompt: str
    descriptive_prompt: Optional[str] = None
    src: str
    owner_id: int
    num_likes: int = 0
    is_generated: bool = False
    is_public: bool = True

class ArtCreate(ArtBase):
    pass

class Art(ArtBase):
    id: int
    date: datetime
    premium: bool = False
    liked_by_user: bool = False

    class Config:
        orm_mode = True

# Like
class LikeBase(BaseModel):
    user_id: int
    art_id: int

    class Config:
        orm_mode = True

# Follow
class FollowBase(BaseModel):
    follower_id: int
    followee_id: int

    class Config:
        orm_mode = True

# SearchHistory
class SearchHistoryBase(BaseModel):
    query: str
    date: datetime

class SearchHistoryCreate(SearchHistoryBase):
    pass

class SearchHistory(SearchHistoryBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True

# ArtHistory
class ArtHistoryBase(BaseModel):
    date: datetime

class ArtHistoryCreate(ArtHistoryBase):
    pass

class ArtHistory(ArtHistoryBase):
    id: int
    art_id: int
    user_id: int

    class Config:
        orm_mode = True

# additional
class CategoryCount(BaseModel):
    name: str
    count: int

class ArtMetadataSchema(BaseModel):
    id: int
    art_id: int
    neg_prompt_text: str
    comments: str
    upvotes: int

    class Config:
        orm_mode = True

class ArtMetadataCreate(BaseModel):
    art_id: int
    neg_prompt_text: str = ""
    comments: str = ""
    upvotes: int = 0

class ProcessedLink(BaseModel):
    link: str

class ProcessedLinkResponse(BaseModel):
    id: int
    link: str
    
    class Config:
        orm_mode = True

class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="The text prompt to generate the image from.")
    number_of_images: int = Field(1, ge=1, le=4, description="Number of images to generate.")

class ImageGenerationResponse(BaseModel):
    image_urls: List[str] = Field(..., description="List of URLs for the generated images.")

class Category(BaseModel):
    id: int
    name: str