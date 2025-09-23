#!/usr/bin/env python3
"""
Debug script to test Vertex AI generation directly
"""
import os
import sys

# Set environment variables
os.environ['GCP_LOCATION'] = 'europe-west1'
os.environ['APP_ENV'] = 'development'

# Add the app directory to Python path
sys.path.append('.')

try:
    print("🔍 Testing Vertex AI generation directly...")
    
    # Import the generation model
    from app.routers.arts import generation_model
    
    print(f"📊 Model type: {type(generation_model)}")
    print(f"📊 Model class: {generation_model.__class__.__name__}")
    
    if "Mock" in str(type(generation_model)):
        print("❌ Still using mock model!")
        sys.exit(1)
    
    print("✅ Using real Vertex AI model")
    
    # Test generation
    print("🎨 Testing image generation...")
    response = generation_model.generate_images(
        prompt="test debug generation",
        number_of_images=1
    )
    
    print(f"📊 Response type: {type(response)}")
    print(f"📊 Response attributes: {dir(response)}")
    
    if hasattr(response, 'images'):
        print(f"📊 Number of images: {len(response.images)}")
        if response.images:
            img = response.images[0]
            print(f"📊 Image type: {type(img)}")
            print(f"📊 Image attributes: {dir(img)}")
            
            # Check different possible attribute names
            for attr in ['_image_bytes', 'image_bytes', 'data', '_data', 'content']:
                if hasattr(img, attr):
                    data = getattr(img, attr)
                    if data:
                        print(f"✅ Found image data in attribute: {attr}")
                        print(f"📊 Data type: {type(data)}")
                        print(f"📊 Data length: {len(data) if hasattr(data, '__len__') else 'N/A'}")
                    else:
                        print(f"⚠️ Attribute {attr} exists but is empty")
    else:
        print("❌ Response has no 'images' attribute")
        print(f"📊 Available attributes: {[attr for attr in dir(response) if not attr.startswith('_')]}")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()






