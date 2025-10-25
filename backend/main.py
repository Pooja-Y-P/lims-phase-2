# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.db import Base, engine

# Import routers
from backend.routes import user_routes
from backend.routes import inward_router
from backend.routes import customer_routes
from backend.routes import srf_router
from backend.routes import password_reset_router
from backend.routes import invitation_routes

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LIMS Backend", version="1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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