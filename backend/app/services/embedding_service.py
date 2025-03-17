from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction
from chromadb.utils.data_loaders import ImageLoader
import io
from PIL import Image
import numpy as np

class MultimodalEmbeddingService:
    def __init__(self):
        self.embedding_function = OpenCLIPEmbeddingFunction()
        self.data_loader = ImageLoader()
        
    def process_image(self, image_data):
        """Process binary image data into format needed for embeddings"""
        if isinstance(image_data, bytes):
            image = Image.open(io.BytesIO(image_data))
            # Convert to RGB if needed (handles PNG with transparency)
            if image.mode != 'RGB':
                image = image.convert('RGB')
            # Convert to numpy array as expected by OpenCLIP
            return np.array(image)
        return None
        
    def get_text_embedding(self, text):
        """Get embedding for text"""
        if not text:
            return None
        return self.embedding_function([text])[0]
    
    def get_image_embedding(self, image_data):
        """Get embedding for image from binary data"""
        if not image_data:
            return None
        image_array = self.process_image(image_data)
        if image_array is not None:
            return self.embedding_function.get_image_embeddings([image_array])[0]
        return None 