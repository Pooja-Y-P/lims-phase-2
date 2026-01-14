from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db

# Adjust these imports to match your actual filenames
from backend.schemas import htw_repeatability_schemas
from backend.services import htw_repeatability_services as services

router = APIRouter(
    prefix="/htw-calculations",
    tags=["HTW Calculations (Repeatability & Reproducibility)"]
)

# ==============================================================================
#                            A. REPEATABILITY ROUTES
# ==============================================================================

@router.post("/repeatability/calculate", response_model=htw_repeatability_schemas.RepeatabilityResponse)
def calculate_repeatability(
    request: htw_repeatability_schemas.RepeatabilityCalculationRequest, 
    db: Session = Depends(get_db)
):
    """
    Calculates Repeatability (Section A).
    Auto-fetches manufacturer specs, calculates Mean, Interpolation, and Deviation.
    """
    try:
        return services.process_repeatability_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Calculation Error: {str(e)}")

@router.get("/repeatability/references/list")
def get_references(db: Session = Depends(get_db)):
    """
    Get list of reference points for frontend dynamic interpolation.
    """
    try:
        return services.get_uncertainty_references(db)
    except Exception as e:
        print(f"SERVER ERROR: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Fetch References Error: {str(e)}"
        )

@router.get("/repeatability/{job_id}", response_model=htw_repeatability_schemas.RepeatabilityResponse)
def get_repeatability(job_id: int, db: Session = Depends(get_db)):
    """
    Fetches stored repeatability data or specs for a new job.
    """
    try:
        return services.get_stored_repeatability(db, job_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Fetch Error: {str(e)}"
        )

# ==============================================================================
#                           B. REPRODUCIBILITY ROUTES
# ==============================================================================

@router.post("/reproducibility/calculate", response_model=htw_repeatability_schemas.ReproducibilityResponse)
def calculate_reproducibility(
    request: htw_repeatability_schemas.ReproducibilityCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates Reproducibility (Section B - B-Test).
    1. Fetches 20% Set Torque from Manufacturer Specs.
    2. Accepts 4 Sequences of 5 Readings.
    3. Calculates b_rep (Max Mean - Min Mean).
    """
    try:
        return services.process_reproducibility_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/reproducibility/{job_id}", response_model=htw_repeatability_schemas.ReproducibilityResponse)
def get_reproducibility(job_id: int, db: Session = Depends(get_db)):
    """
    Fetches stored reproducibility data or sets up the table for a new calculation.
    """
    try:
        return services.get_stored_reproducibility(db, job_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))