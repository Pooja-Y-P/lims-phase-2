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

# --- NEW DRAFT ENDPOINT ---
@router.post("/repeatability/draft", response_model=htw_repeatability_schemas.RepeatabilityResponse)
def save_repeatability_draft(
    request: htw_repeatability_schemas.RepeatabilityCalculationRequest, 
    db: Session = Depends(get_db)
):
    """
    Draft Endpoint:
    - Saves current table state immediately.
    - Does not enforce strict spec compliance.
    - Calculates interim results (Mean, Deviation) where data exists.
    """
    try:
        return services.process_repeatability_draft(db, request)
    except Exception as e:
        # Log the error internally but return a 500
        print(f"Draft Save Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Draft Error: {str(e)}")


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

@router.post("/reproducibility/draft", response_model=htw_repeatability_schemas.ReproducibilityResponse)
def save_reproducibility_draft(
    request: htw_repeatability_schemas.ReproducibilityCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Draft Endpoint for Reproducibility:
    - Saves sequences immediately.
    - Calculates b_rep if data is sufficient, otherwise sets it to 0.
    """
    try:
        return services.process_reproducibility_draft(db, request)
    except Exception as e:
        print(f"Draft Save Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Draft Error: {str(e)}")

@router.post("/reproducibility/calculate", response_model=htw_repeatability_schemas.ReproducibilityResponse)
def calculate_reproducibility(
    request: htw_repeatability_schemas.ReproducibilityCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Standard Calculation Endpoint.
    """
    try:
        return services.process_reproducibility_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/reproducibility/{job_id}", response_model=htw_repeatability_schemas.ReproducibilityResponse)
def get_reproducibility(job_id: int, db: Session = Depends(get_db)):
    try:
        return services.get_stored_reproducibility(db, job_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ==============================================================================
#                     SECTION C: OUTPUT DRIVE VARIATION
# ==============================================================================

@router.post("/output-drive/draft", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def save_output_drive_draft(
    request: htw_repeatability_schemas.GeometricCalculationRequest,
    db: Session = Depends(get_db)
):
    try:
        return services.process_output_drive_draft(db, request)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/output-drive/calculate", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def calculate_output_drive(
    request: htw_repeatability_schemas.GeometricCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates Output Drive Variation (b_out).
    Positions: 0, 90, 180, 270.
    10 readings per position.
    Result = Max(Means) - Min(Means).
    """
    try:
        return services.process_output_drive_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/output-drive/{job_id}", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def get_output_drive(job_id: int, db: Session = Depends(get_db)):
    try:
        return services.get_stored_output_drive(db, job_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ==============================================================================
#                     SECTION D: DRIVE INTERFACE VARIATION
# ==============================================================================

@router.post("/drive-interface/draft", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def save_drive_interface_draft(
    request: htw_repeatability_schemas.GeometricCalculationRequest,
    db: Session = Depends(get_db)
):
    try:
        return services.process_drive_interface_draft(db, request)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/drive-interface/calculate", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def calculate_drive_interface(
    request: htw_repeatability_schemas.GeometricCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates Drive Interface Variation (b_int).
    Positions: 0, 90, 180, 270.
    10 readings per position.
    Result = Max(Means) - Min(Means).
    """
    try:
        return services.process_drive_interface_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/drive-interface/{job_id}", response_model=htw_repeatability_schemas.GeometricVariationResponse)
def get_drive_interface(job_id: int, db: Session = Depends(get_db)):
    try:
        return services.get_stored_drive_interface(db, job_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

# ==============================================================================
#                     SECTION E: LOADING POINT VARIATION
# ==============================================================================

@router.post("/loading-point/draft", response_model=htw_repeatability_schemas.LoadingPointResponse)
def save_loading_point_draft(
    request: htw_repeatability_schemas.LoadingPointRequest,
    db: Session = Depends(get_db)
):
    try:
        return services.process_loading_point_draft(db, request)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/loading-point/calculate", response_model=htw_repeatability_schemas.LoadingPointResponse)
def calculate_loading_point(
    request: htw_repeatability_schemas.LoadingPointRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates Loading Point Variation (b_l).
    Positions: -10mm, 10mm.
    10 readings per position.
    Result = | Mean(-10) - Mean(+10) |.
    """
    try:
        return services.process_loading_point_calculation(db, request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.get("/loading-point/{job_id}", response_model=htw_repeatability_schemas.LoadingPointResponse)
def get_loading_point(job_id: int, db: Session = Depends(get_db)):
    try:
        return services.get_stored_loading_point(db, job_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))