#!/usr/bin/env python3
"""
Test script to check ChromaDB status and collection data
"""
import os
os.environ['APP_ENV'] = 'development'

from app.chroma_services import chroma, collection_prompts

print("🔍 ChromaDB Status Check")
print(f"ChromaDB client: {chroma.client}")
print(f"Collection prompts: {collection_prompts}")

if collection_prompts:
    try:
        # Try to count items in collection
        count = collection_prompts.count()
        print(f"📊 Collection 'Prompts' has {count} items")
        
        if count == 0:
            print("❌ Collection is EMPTY - this is why search returns no results!")
        else:
            print("✅ Collection has data")
            
    except Exception as e:
        print(f"❌ Error checking collection: {e}")
else:
    print("❌ Collection is None - ChromaDB not available")
