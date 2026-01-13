from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.schemas import htw_repeatability_schemas
from backend.services import htw_repeatability_services

router = APIRouter(
    prefix="/repeatability",
    tags=["Repeatability Calculation"]
)

@router.post("/calculate", response_model=htw_repeatability_schemas.RepeatabilityResponse)
def calculate_repeatability(
    request: htw_repeatability_schemas.RepeatabilityCalculationRequest, 
    db: Session = Depends(get_db)
):
    """
    Calculates Repeatability for 20%, 60%, and 100% steps.
    Stores results in htw_repeatability and htw_repeatability_reading.
    """
    try:
        return htw_repeatability_services.process_repeatability_calculation(db, request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Calculation Error: {str(e)}"
        )

@router.get("/{job_id}")
def get_repeatability(job_id: int, db: Session = Depends(get_db)):
    """
    Fetches saved repeatability data (Set Pressure, Torque, Readings, Results).
    This endpoint allows the frontend to populate the table on page load.
    """
    try:
        return htw_repeatability_services.get_stored_repeatability(db, job_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Fetch Error: {str(e)}"
        )