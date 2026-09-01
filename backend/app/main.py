import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api import auth, claims, documents, geometries, analysis, schemes, dss, audit, stats, sentinel
from app.models.user import User
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
    return JSONResponse(status_code=503, content={"detail": str(exc), "source": "Copernicus Sentinel-2 L2A"})

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev / production config
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

@app.on_event("startup")
def startup_event():
    """Checks database state on startup and initializes system essentials (Users, Schemes, RAG docs) if clean."""
    db = SessionLocal()
    try:
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
