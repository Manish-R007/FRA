import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import auth, claims, documents, geometries, analysis, schemes, dss, audit, stats, sentinel, coverage
from app.models.user import User
from app.models.claim import FRAClaim
from app.services.state_normalizer import normalize_state_name
from app.services.sentinel_hub_service import LiveSentinelDataUnavailable

# Initialize tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)


@app.exception_handler(LiveSentinelDataUnavailable)
async def live_sentinel_unavailable(_: Request, exc: LiveSentinelDataUnavailable):
    """Never substitute synthetic data when a live observation cannot be obtained."""
    detail_msg = str(exc)
    if not detail_msg.startswith("Problem in fetching real-time"):
        detail_msg = f"Problem in fetching real-time Sentinel-2 data: {detail_msg}"
    return JSONResponse(
        status_code=503,
        content={
            "detail": detail_msg,
            "error": "problem in fetching real time",
            "source": "Copernicus Sentinel-2 L2A"
        }
    )

# CORS middleware for frontend access
default_cors_origins = [
    "http://localhost:3000",
    "https://fra-atlas-frontend-ten.vercel.app",
]
cors_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", ",".join(default_cors_origins)).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory for document & satellite image serving
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(claims.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(geometries.router, prefix=settings.API_V1_STR)
app.include_router(analysis.router, prefix=settings.API_V1_STR)
app.include_router(sentinel.router, prefix=settings.API_V1_STR)
app.include_router(schemes.router, prefix=settings.API_V1_STR)
app.include_router(dss.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(stats.router, prefix=settings.API_V1_STR)
app.include_router(coverage.router, prefix=settings.API_V1_STR)

@app.on_event("startup")
def startup_event():
    """Checks database state on startup and initializes system essentials (Users, Schemes, RAG docs) if clean."""
    db = SessionLocal()
    try:
        # Canonicalize existing multilingual state values once at startup so
        # filters, permissions, and SQL groupings use the same state key.
        for model in (FRAClaim, User):
            for record in db.query(model).filter(model.state.isnot(None)).yield_per(500):
                canonical = normalize_state_name(record.state)
                if canonical != record.state:
                    record.state = canonical
        db.commit()
        user_count = db.query(User).count()
        if user_count == 0:
            print("Clean database detected on startup. Initializing system essentials (0 Claims)...")
            from app.seed.seed_data import seed_system_essentials
            seed_system_essentials(db)
    except Exception as e:
        print(f"Startup check warning: {e}")
    finally:
        db.close()

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "PRODUCTION_READY"
    }

@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "health": "/health"
    }
