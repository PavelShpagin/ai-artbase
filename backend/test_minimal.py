#!/usr/bin/env python3
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Minimal Test API")

@app.get("/")
def read_root():
    return {"message": "Minimal API is working!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    print("🚀 Starting minimal FastAPI test...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")


