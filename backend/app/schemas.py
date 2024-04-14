from pydantic import BaseModel
from typing import Optional
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
    
    class Config:
        orm_mode = True

# Art
class ArtBase(BaseModel):
    prompt: str

class ArtCreate(ArtBase):
    pass

class Art(ArtBase):
    id: int
    src: str
    date: datetime
    width: int
    height: int
    premium: bool
    owner_id: Optional[int] = None

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