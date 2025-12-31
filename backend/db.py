# backend/db.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# # Example connection (update with your DB)
DATABASE_URL="postgresql://postgres:root@localhost:5432/lims_phase_2"
# DATABASE_URL="postgresql://postgres:postgres@postgres:5432/limsdbp1"
# DATABASE_URL="postgresql://postgres:RAGHUhr1@localhost:5432/limslab2"
# DATABASE_URL="postgresql://postgres:root@localhost:5432/lims_phase2"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
