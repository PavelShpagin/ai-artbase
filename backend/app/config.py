import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database configuration
URL_DATABASE = os.environ.get('DATABASE_URL')

# Security configuration
SECRET_KEY = os.environ.get('SECRET_KEY')
ALGORITHM = os.environ.get('ALGORITHM')
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES'))

# Application paths
CHROMA_DB_PATH = os.environ.get('CHROMA_DB_PATH')

# OpenAI configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# Cloudflare R2 Configuration
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY')
R2_ENDPOINT_URL = os.environ.get('R2_ENDPOINT_URL')
R2_BUCKET_NAME = os.environ.get('R2_BUCKET_NAME')
R2_PUBLIC_URL = os.environ.get('R2_PUBLIC_URL')