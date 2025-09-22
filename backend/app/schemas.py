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
        from_attributes = True

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
        from_attributes = True

# Like
class LikeBase(BaseModel):
    user_id: int
    art_id: int

    class Config:
        from_attributes = True

# Follow
class FollowBase(BaseModel):
    follower_id: int
    followee_id: int

    class Config:
        from_attributes = True

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
        from_attributes = True

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
        from_attributes = True

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
        from_attributes = True

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
        from_attributes = True

class Category(BaseModel):
    id: int
    name: str