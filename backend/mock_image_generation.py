#!/usr/bin/env python3
"""
Mock image generation service for development/testing
Creates placeholder images when Vertex AI is not available
"""
import io
import hashlib
from PIL import Image, ImageDraw, ImageFont
import random

def create_mock_image(prompt: str, width: int = 512, height: int = 512) -> bytes:
    """
    Create a mock generated image with the prompt text
    """
    # Create a new image with a random background color
    colors = [
        (135, 206, 235),  # Sky blue
        (255, 182, 193),  # Light pink
        (144, 238, 144),  # Light green
        (255, 218, 185),  # Peach
        (221, 160, 221),  # Plum
        (255, 239, 213),  # Papaya whip
    ]
    
    bg_color = random.choice(colors)
    image = Image.new('RGB', (width, height), bg_color)
    draw = ImageDraw.Draw(image)
    
    # Try to use a default font, fallback to basic if not available
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        try:
            font = ImageFont.load_default()
        except:
            font = None
    
    # Add "AI Generated" text
    text_lines = [
        "🎨 AI Generated Image",
        "",
        f"Prompt: {prompt[:50]}{'...' if len(prompt) > 50 else ''}",
        "",
        "Mock Generation",
        "(Vertex AI not available)"
    ]
    
    # Calculate text positioning
    y_offset = 50
    for line in text_lines:
        if font:
            bbox = draw.textbbox((0, 0), line, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
        else:
            text_width = len(line) * 6  # Rough estimate
            text_height = 11
        
        x = (width - text_width) // 2
        
        # Add text shadow
        if font:
            draw.text((x + 2, y_offset + 2), line, fill=(0, 0, 0, 128), font=font)
            draw.text((x, y_offset), line, fill=(255, 255, 255), font=font)
        else:
            draw.text((x + 2, y_offset + 2), line, fill=(0, 0, 0))
            draw.text((x, y_offset), line, fill=(255, 255, 255))
        
        y_offset += text_height + 10
    
    # Add decorative border
    draw.rectangle([10, 10, width-10, height-10], outline=(255, 255, 255), width=3)
    draw.rectangle([15, 15, width-15, height-15], outline=(0, 0, 0), width=1)
    
    # Convert to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr.getvalue()

class MockImageGenerationResponse:
    """Mock response object that mimics Vertex AI response structure"""
    def __init__(self, prompt: str, number_of_images: int = 1):
        self.images = []
        for i in range(number_of_images):
            mock_image = MockGeneratedImage(prompt, i)
            self.images.append(mock_image)

class MockGeneratedImage:
    """Mock generated image object that mimics Vertex AI structure"""
    def __init__(self, prompt: str, index: int = 0):
        self.prompt = prompt
        self.index = index
        self._image_bytes = create_mock_image(f"{prompt} #{index + 1}")

class MockImageGenerationModel:
    """Mock image generation model for development"""
    
    @staticmethod
    def from_pretrained(model_name: str):
        print(f"🎭 Using mock image generation model: {model_name}")
        return MockImageGenerationModel()
    
    def generate_images(self, prompt: str, number_of_images: int = 1):
        """Generate mock images"""
        print(f"🎨 Mock generating {number_of_images} image(s) for prompt: '{prompt}'")
        return MockImageGenerationResponse(prompt, number_of_images)



