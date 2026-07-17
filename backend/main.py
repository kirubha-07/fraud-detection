"""backend/main.py — FastAPI application entry point.

Run with:
    cd fraud-detection
    .venv/Scripts/uvicorn.exe backend.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ── ensure project root is on sys.path ────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ── internal imports ──────────────────────────────────────────────────────────
from backend.routers import explainability, kpis, metrics, scoring
from backend.services.model_service import startup as load_models
from backend.schemas import HealthResponse
from backend.services.model_service import state

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan: load everything once before the server starts serving ───────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== FraudOps API: startup ===")
    load_models()
    logger.info("=== FraudOps API: ready ===")
    yield
    logger.info("=== FraudOps API: shutdown ===")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FraudOps Analytics API",
    description=(
        "REST API wrapping PaySim fraud-detection models trained with "
        "Logistic Regression, Random Forest, XGBoost, and Isolation Forest. "
        "All model training/evaluation logic lives in src/; this service is "
        "a thin presentation layer."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS (allow Next.js dev server and prod build) ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global 500 handler: never expose raw stack traces ─────────────────────────
@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}"},
    )


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Liveness check — returns list of loaded models."""
    featured = state.get("featured")
    return HealthResponse(
        status="ok",
        models_loaded=sorted(state.get("bundles", {}).keys()),
        data_rows=len(featured) if featured is not None else 0,
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(kpis.router,            prefix="/api", tags=["kpis"])
app.include_router(scoring.router,         prefix="/api", tags=["scoring"])
app.include_router(metrics.router,         prefix="/api", tags=["metrics"])
app.include_router(explainability.router,  prefix="/api", tags=["explainability"])
