import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from chromadb.config import Settings
import os
from .config import *

# Define the default local persistence directory relative to this file if CHROMA_DB_PATH is not set
DEFAULT_LOCAL_CHROMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chroma_db_local")

class ChromaService:
    def __init__(self):
        self.embedding_function = OpenAIEmbeddingFunction(api_key=OPENAI_API_KEY, model_name="text-embedding-ada-002")

        # Determine environment (default to production if not set)
        app_env = os.getenv("APP_ENV", "production").lower()

        if app_env == "development":
            # Use CHROMA_DB_PATH env var for path, fallback to default
            local_chroma_path = os.getenv("CHROMA_DB_PATH", DEFAULT_LOCAL_CHROMA_PATH)
            # Ensure the directory exists
            os.makedirs(local_chroma_path, exist_ok=True)
            print(f"--- ChromaDB running in DEVELOPMENT mode (persistent path: {local_chroma_path}) ---")
            # Use a persistent client for local development
            self.client = chromadb.PersistentClient(path=local_chroma_path)
        else:
            print("--- ChromaDB running in PRODUCTION mode (HttpClient) ---")
            # Use HttpClient for production (connecting to a separate ChromaDB server/service)
            chroma_host = os.getenv("CHROMA_HOST", "chromadb") # Default to Docker service name
            chroma_port = os.getenv("CHROMA_PORT", "8001")    # Default to internal port
            self.client = chromadb.HttpClient(
                host=chroma_host,
                port=int(chroma_port)
                # Consider adding settings=Settings(allow_reset=True) or other relevant settings if needed
            )

    def get(self, name: str):
        try:
            collection = self.client.get_collection(name=name, embedding_function=self.embedding_function)
        except Exception as e:
            collection = self.client.create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
                embedding_function=self.embedding_function
            )
        return collection
    
    def delete(self, name: str):
         self.client.delete_collection(name=name)

chroma = ChromaService()

collection_prompts = chroma.get("Prompts")
collection_categories = chroma.get("Categories")

def filter_chroma(results, threshold=0.47):
        int_ids = [int(id_) for id_ in results["ids"][0]]
        distances = results["distances"][0]
        return [id_ for id_, distance in zip(int_ids, distances) if distance < threshold]