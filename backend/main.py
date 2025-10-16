# backend/main.py

print("\n\n🔥🔥🔥 SERVER IS RUNNING THE CORRECT main.py! 🔥🔥🔥\n\n")

from fastapi import FastAPI
from backend.db import Base, engine

# Note: I am assuming your inward router is in `backend/routers/inward_router.py`
from backend.routes import user_routes
from backend.routes import inward_router

from fastapi.middleware.cors import CORSMiddleware

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="LIMS Backend", version="1.0")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with the /api prefix
app.include_router(user_routes.router, prefix="/api")
app.include_router(inward_router.router, prefix="/api")

@app.get("/")
def root():
    return {"message": "LIMS backend running successfully"}