import os
import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from config import *

class ChromaService:
    def __init__(self):
        self.embedding_function = OpenAIEmbeddingFunction(api_key=OPENAI_API_KEY, model_name="text-embedding-ada-002")
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

    def get(self, name: str):
        return self.client.get_or_create_collection(name=name, embedding_function=self.embedding_function)

chroma = ChromaService()

collection_prompts = chroma.get("Prompts")
collection_categories = chroma.get("Categories")

def filter_chroma(self, results, threshold=0.47):
        int_ids = [int(id_) for id_ in results["ids"][0]]
        distances = results["distances"][0]
        return [id_ for id_, distance in zip(int_ids, distances) if distance < threshold]