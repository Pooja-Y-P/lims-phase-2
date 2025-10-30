# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.db import Base, engine

# Import routers
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

# ✅ Updated CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",     # Added for your frontend port
        "http://127.0.0.1:5174"      # Added for 127.0.0.1 variant
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers with the /api prefix
app.include_router(user_routes.router, prefix="/api")
app.include_router(inward_router.router, prefix="/api")
app.include_router(customer_routes.router, prefix="/api")
app.include_router(srf_router.router, prefix="/api")
app.include_router(password_reset_router.router, prefix="/api")
app.include_router(invitation_routes.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "LIMS backend running successfully"}
