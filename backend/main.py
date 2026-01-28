# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.db import Base, engine
from backend import models  # Ensure models are registered before create_all
import time
import logging 


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
from backend.routes.htw_master_standard_router import router as htw_master_standard_router
from backend.routes.htw_manufacturer_spec_router import router as htw_manufacturer_spec_router
from backend.routes.htw_pressure_gauge_res_router import router as htw_pressure_gauge_res_router
from backend.routes.htw_nomenclature_range_router import router as htw_nomenclature_range_router
from backend.routes.htw_job_standard import router as htw_job_standard_router
from backend.routes.htw_job import router as htw_job
from backend.routes.htw_standard_uncertanity_reference_router import router as htw_standard_uncertanity_reference_router
from backend.routes.htw_job_environment_router  import router as htw_job_environment_router
from backend.routes.htw_repeatability_router import router as htw_repeatability_router
from backend.routes.htw_const_coverage_factor_router import router as htw_const_coverage_factor_router
from backend.routes.htw_t_distribution_router import router as htw_t_distribution_router
from backend.routes.htw_un_pg_master_router import router as htw_un_pg_master_router
from backend.routes.htw_cmc_reference_router import router as htw_cmc_reference_router
from backend.routes.htw_tool_type_router import router as htw_tool_type_router
from backend.routes.htw_max_val_measure_err_router import router as htw_max_val_measure_err_router
from backend.routes.htw_uncertanity_budget_router import router as htw_uncertanity_budget_router


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables with retry logic
max_retries = 5
retry_delay = 2

for attempt in range(max_retries):
    try:
        logger.info(f"Attempting to create database tables (attempt {attempt + 1}/{max_retries})...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully!")
        break
    except Exception as e:
        if attempt < max_retries - 1:
            logger.warning(f"Failed to create tables: {e}. Retrying in {retry_delay} seconds...")
            time.sleep(retry_delay)
        else:
            logger.error(f"Failed to create tables after {max_retries} attempts: {e}")
            raise

# Initialize FastAPI app
app = FastAPI(title="LIMS Backend", version="1.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    # allow_origins=[
    #     "http://localhost:3000",
    #     "http://127.0.0.1:3000",
    #     "http://localhost:5173",
    #     "http://127.0.0.1:5173",
    #     "http://localhost:5174",
    #     "http://127.0.0.1:5174"
    # ],
    allow_origins = ["*"],
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
app.include_router(htw_master_standard_router, prefix="/api")
app.include_router(htw_manufacturer_spec_router, prefix="/api")
app.include_router(htw_pressure_gauge_res_router, prefix="/api")
app.include_router(htw_nomenclature_range_router, prefix="/api")
app.include_router(htw_job_standard_router, prefix="/api")
app.include_router(htw_job, prefix="/api")
app.include_router(htw_repeatability_router, prefix="/api")
app.include_router(htw_job_environment_router, prefix="/api")
app.include_router(htw_const_coverage_factor_router, prefix="/api")
app.include_router(htw_t_distribution_router, prefix="/api")
app.include_router(htw_un_pg_master_router, prefix="/api")
app.include_router(htw_cmc_reference_router, prefix="/api")
app.include_router(htw_tool_type_router, prefix="/api")
app.include_router(htw_max_val_measure_err_router, prefix="/api")
app.include_router(htw_standard_uncertanity_reference_router, prefix="/api")
app.include_router(htw_uncertanity_budget_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "LIMS backend running successfully"}