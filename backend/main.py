# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db import Base, engine

# Import routers
from backend.routes import user_routes
from backend.routes import inward_router
from backend.routes import customer_routes

# Import dependencies

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

# Include routers with the /api prefix
app.include_router(user_routes.router, prefix="/api")
app.include_router(inward_router.router, prefix="/api")
app.include_router(customer_routes.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "LIMS backend running successfully"}