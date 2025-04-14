import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
import os
from .config import *

class ChromaService:
    def __init__(self):
        self.embedding_function = OpenAIEmbeddingFunction(api_key=OPENAI_API_KEY, model_name="text-embedding-ada-002")
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

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