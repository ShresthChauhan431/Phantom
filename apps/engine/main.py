"""
Phantom Engine — Main Entry Point
"""
import asyncio
from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Phantom Engine", version="0.1.0")

@app.get("/")
async def root():
    return {"message": "Phantom Engine Running", "version": "0.1.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

def main():
    print("🔮 Phantom Engine Starting...")
    print("📡 API: http://localhost:8000")
    print("📚 Docs: http://localhost:8000/docs")
    
    uvicorn.run(
        "apps.engine.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

if __name__ == "__main__":
    main()
