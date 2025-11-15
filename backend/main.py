# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.db import Base, engine
from backend import models  # Ensure models are registered before create_all

# Import routers
# These imports are likely being aliased in backend/routes/__init__.py
# For example: from .user_routes import router as user_routes
from backend.routes import (
    user_routes,
    inward_router,
    customer_routes,
    srf_router,
    password_reset_router,
    invitation_routes
)

# Create tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(title="LIMS Backend", version="1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# === FIX IS HERE ===
# Include routers with the /api prefix
# Remove the unnecessary ".router" from each line
app.include_router(user_routes.router, prefix="/api")
app.include_router(inward_router.router, prefix="/api")
app.include_router(customer_routes.router, prefix="/api")
app.include_router(srf_router.router, prefix="/api")
app.include_router(password_reset_router.router, prefix="/api")
app.include_router(invitation_routes.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "LIMS backend running successfully"}