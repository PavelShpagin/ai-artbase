from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from .config import *

# Configure engine with proper connection pooling for remote database
engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Number of connections to maintain in pool
    max_overflow=20,       # Additional connections beyond pool_size
    pool_timeout=30,       # Seconds to wait for connection from pool
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Validate connections before use
    echo=False             # Set to True for SQL debugging
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()