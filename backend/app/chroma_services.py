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
        self.client = None

        # Check if ChromaDB is disabled
        if os.getenv("DISABLE_CHROMA", "false").lower() == "true":
            print("--- ChromaDB DISABLED for testing ---")
            return

        # Determine environment (default to production if not set)
        app_env = os.getenv("APP_ENV", "production").lower()

        try:
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
                
                # Add timeout to prevent hanging (Windows-compatible)
                import threading
                import time
                
                def connect_with_timeout():
                    client = chromadb.HttpClient(
                        host=chroma_host,
                        port=int(chroma_port)
                    )
                    # Test the connection
                    client.heartbeat()
                    return client
                
                # Use threading for timeout (cross-platform)
                result = [None]
                exception = [None]
                
                def target():
                    try:
                        result[0] = connect_with_timeout()
                    except Exception as e:
                        exception[0] = e
                
                thread = threading.Thread(target=target)
                thread.daemon = True
                thread.start()
                thread.join(timeout=10)  # 10 second timeout
                
                if thread.is_alive():
                    raise TimeoutError("ChromaDB connection timeout")
                elif exception[0]:
                    raise exception[0]
                else:
                    self.client = result[0]
                    print(f"✅ ChromaDB connected to {chroma_host}:{chroma_port}")
        except Exception as e:
            print(f"--- ChromaDB connection failed: {e} ---")
            print("--- Running without ChromaDB (search functionality will be limited) ---")
            self.client = None

    def get(self, name: str):
        if self.client is None:
            print(f"ChromaDB not available, returning None for collection: {name}")
            return None
        try:
            collection = self.client.get_collection(name=name, embedding_function=self.embedding_function)
            # Check if collection is empty and return None to force fallback
            if collection.count() == 0:
                print(f"ChromaDB collection '{name}' is empty, using fallback mode")
                return None
        except Exception as e:
            collection = self.client.create_collection(
                name=name,
                metadata={"hnsw:space": "cosine"},
                embedding_function=self.embedding_function
            )
            # New collection is empty, return None to force fallback
            print(f"ChromaDB collection '{name}' created but empty, using fallback mode")
            return None
        return collection
    
    def delete(self, name: str):
        if self.client is None:
            print(f"ChromaDB not available, cannot delete collection: {name}")
            return
        self.client.delete_collection(name=name)

chroma = ChromaService()

collection_prompts = chroma.get("Prompts")
collection_categories = chroma.get("Categories")

def filter_chroma(results, threshold=0.47):
        int_ids = [int(id_) for id_ in results["ids"][0]]
        distances = results["distances"][0]
        return [id_ for id_, distance in zip(int_ids, distances) if distance < threshold]