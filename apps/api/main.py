import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_pool, init_pool
from app.health import full_health
from app.middleware import RequestLoggingMiddleware
from app.migrate import run_migrations
from app.redis_client import close_redis, init_redis
from app.routes import admin, auth, chat, documents, memory, projects, tasks

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting Veyra API...")
    init_pool(settings.database_url)
    init_redis(settings.redis_url)
    run_migrations(settings.migrations_dir)
    yield
    close_redis()
    close_pool()
    logger.info("Shutting down Veyra API...")


app = FastAPI(
    title="Veyra API",
    description="Developer-First AI Platform Backend Services",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(chat.router)
app.include_router(tasks.router)
app.include_router(memory.router)
app.include_router(documents.router)
app.include_router(admin.router)


@app.get("/health")
async def health_check():
    return full_health()


@app.get("/")
async def root():
    return {
        "name": "Veyra API",
        "version": "0.2.0",
        "description": "Developer-First AI Platform Backend Services",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)