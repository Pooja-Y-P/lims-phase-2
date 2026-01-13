from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.schemas import htw_repeatability_schemas
from backend.services import htw_repeatability_services

router = APIRouter(
    prefix="/repeatability",
    tags=["Repeatability Calculation"]
)

# 1. Calculate Endpoint
@router.post("/calculate", response_model=htw_repeatability_schemas.RepeatabilityResponse)
def calculate_repeatability(
    request: htw_repeatability_schemas.RepeatabilityCalculationRequest, 
    db: Session = Depends(get_db)
):
    try:
        return htw_repeatability_services.process_repeatability_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Calculation Error: {str(e)}")

# 2. Get References Endpoint (MUST BE BEFORE /{job_id})
@router.get("/references/list")
def get_references(db: Session = Depends(get_db)):
    """
    Get list of reference points for frontend interpolation.
    """
    try:
        return htw_repeatability_services.get_uncertainty_references(db)
    except Exception as e:
        # Print error to server logs
        print(f"SERVER ERROR: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Fetch References Error: {str(e)}"
        )

# 3. Get Job Data Endpoint
@router.get("/{job_id}")
def get_repeatability(job_id: int, db: Session = Depends(get_db)):
    try:
        return htw_repeatability_services.get_stored_repeatability(db, job_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Fetch Error: {str(e)}"
        )