from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.routes import chat, tasks, memory

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Starting Veyra API...")
    yield
    # Shutdown
    print("Shutting down Veyra API...")

app = FastAPI(
    title="Veyra API",
    description="Developer-First AI Platform Backend Services",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)
app.include_router(tasks.router)
app.include_router(memory.router)
app.include_router(auth.router)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "veyra-api"}

@app.get("/")
async def root():
    return {
        "name": "Veyra API",
        "version": "0.1.0",
        "description": "Developer-First AI Platform Backend Services"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
