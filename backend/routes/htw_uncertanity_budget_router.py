from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi import Query 
from backend.db  import get_db 
from typing import List # Import List
from backend.schemas.htw_uncertanity_budget_schema import UncertaintyBudgetDetailResponse, UncertaintyCalculationRequest, UncertaintyCalculationResponse
from backend.services.htw_uncertanity_budget_service import UncertaintyService

router = APIRouter(
    prefix="/uncertainty",
    tags=["Uncertainty Calculation"]
)

@router.post("/uncertainity-calculation", response_model=UncertaintyCalculationResponse)
def calculate_uncertainty_components(
    request: UncertaintyCalculationRequest,
    db: Session = Depends(get_db)
):
    """
    Calculates Uncertainty Components and updates the Uncertainty Budget table.
    
    Calculated Components:
    1. δS_un (Pressure gauge uncertainty)
    2. δP (Resolution of Input Pressure)
    
    Requires Inward ID and Inward Equipment ID to identify the job.
    """
    try:
        result = UncertaintyService.calculate_uncertainty_budget(
            db=db,
            inward_id=request.inward_id,
            inward_eqp_id=request.inward_eqp_id
        )
        return UncertaintyCalculationResponse(
            message="Uncertainty components (δS_un, δP) calculated successfully",
            job_id=result["job_id"],
            steps_calculated=result["count"]
        )
    except Exception as e:
        # In production, log error properly
        raise e
    



# ... imports ...

@router.get("/budget", response_model=List[UncertaintyBudgetDetailResponse]) # Changed to List[]
def get_uncertainty_budget(
    inward_eqp_id: int = Query(..., description="The Inward Equipment ID"),
    db: Session = Depends(get_db)
):
    """
    Retrieves ALL calculated Uncertainty Budget steps for a specific equipment.
    """
    budgets = UncertaintyService.get_budget_by_equipment(db, inward_eqp_id)
    
    # Return empty list if no data found (Frontend will handle empty state)
    if not budgets:
        return []
        
    return budgets