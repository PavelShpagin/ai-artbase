from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

art_categories = Table('art_categories', Base.metadata,
    Column('art_id', Integer, ForeignKey('arts.id'), primary_key=True),
    Column('category_id', Integer, ForeignKey('categories.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    picture = Column(String, default="")
    description = Column(String, default="")
    username = Column(String, default="")
    hidden = Column(Boolean, default=False)
    premium = Column(Boolean, default=False)
    role = Column(String, default="user")

    arts = relationship("Art", back_populates="owner")
    likes = relationship("Like", back_populates="user")
    followers = relationship("Follow", foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan")
    following = relationship("Follow", foreign_keys="Follow.followee_id", back_populates="followee", cascade="all, delete-orphan")
    search_history = relationship("SearchHistory", back_populates="user")
    art_history = relationship("ArtHistory", back_populates="user")

class Art(Base):
    __tablename__ = "arts"
    
    id = Column(Integer, primary_key=True, index=True)
    src = Column(String)
    prompt = Column(String)
    width = Column(Integer)
    height = Column(Integer)
    premium = Column(Boolean, default=False)
    date = Column(DateTime, default= datetime.utcnow)
    owner_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="arts")
    likes = relationship("Like", back_populates="art")
    art_history = relationship("ArtHistory", back_populates="art")
    categories = relationship("Category", secondary=art_categories, back_populates="arts")
    art_metadata = relationship("ArtMetadata", back_populates="art", uselist=False)

class SearchHistory(Base):
    __tablename__ = "search_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    query = Column(String)
    date = Column(DateTime)

    user = relationship("User", back_populates="search_history")

class ArtHistory(Base):
    __tablename__ = "art_history"

    id = Column(Integer, primary_key=True, index=True)
    art_id = Column(Integer, ForeignKey("arts.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime)

    user = relationship("User", back_populates="art_history")
    art = relationship("Art", back_populates="art_history")

class Like(Base):
    __tablename__ = "likes"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    art_id = Column(Integer, ForeignKey("arts.id"), primary_key=True)

    user = relationship("User", back_populates="likes")
    art = relationship("Art", back_populates="likes")

class Follow(Base):
    __tablename__ = "follows"
    
    follower_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    followee_id = Column(Integer, ForeignKey("users.id"), primary_key=True)

    follower = relationship("User", foreign_keys=[follower_id], back_populates="followers")
    followee = relationship("User", foreign_keys=[followee_id], back_populates="following")
    
class Category(Base):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)

    arts = relationship("Art", secondary=art_categories, back_populates="categories")

class ArtMetadata(Base):
    __tablename__ = 'art_metadata'
    
    id = Column(Integer, primary_key=True, index=True)
    art_id = Column(Integer, ForeignKey('arts.id'), unique=True)
    neg_prompt_text = Column(String)
    comments = Column(String)
    upvotes = Column(Integer)
    
    art = relationship("Art", back_populates="art_metadata")

class ProcessedLink(Base):
    __tablename__ = 'processed_links'
    
    id = Column(Integer, primary_key=True, index=True)
    link = Column(String, unique=True, index=True)