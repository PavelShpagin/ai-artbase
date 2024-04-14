import os

URL_DATABASE = 'postgresql://postgres:pirate228@localhost:5432/Ai_ArtBase'
SECRET_KEY = 'AtZghBNnNvBby/K1BM4G5kBYG0ufb5HBX+OwteFxwx4='
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30
CHROMA_DB_PATH = './backend/chroma_data'
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
IMAGE_BASE_URL = 'http://localhost:8001/images'