from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional
 
from backend.db import get_db
from backend.schemas.htw_standard_uncertainty_reference_schemas import (
    HTWStandardUncertaintyReferenceCreate,
    HTWStandardUncertaintyReferenceResponse,
    HTWStandardUncertaintyReferenceUpdate
)
from backend.services.htw_standard_uncertainty_reference_service import (
    create_reference,
    get_references,
    get_reference_by_id,
    update_reference,
    delete_reference
)
 
router = APIRouter(
    prefix="/htw-standard-uncertainty",
    tags=["HTW Standard Uncertainty Reference"]
)
 
 
# -------------------- POST --------------------
@router.post(
    "",
    response_model=HTWStandardUncertaintyReferenceResponse,
    status_code=status.HTTP_201_CREATED
)
def create_htw_standard_uncertainty_reference(
    payload: HTWStandardUncertaintyReferenceCreate,
    db: Session = Depends(get_db)
):
    return create_reference(db, payload)
 
 
# -------------------- GET (ALL) --------------------
@router.get(
    "",
    response_model=List[HTWStandardUncertaintyReferenceResponse],
    status_code=status.HTTP_200_OK
)
def get_htw_standard_uncertainty_references(
    is_active: Optional[bool] = Query(None),
    torque_nm: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    return get_references(
        db=db,
        is_active=is_active,
        torque_nm=torque_nm
    )
 
 
# -------------------- GET (BY ID) --------------------
@router.get(
    "/{reference_id}",
    response_model=HTWStandardUncertaintyReferenceResponse,
    status_code=status.HTTP_200_OK
)
def get_htw_standard_uncertainty_reference_by_id(
    reference_id: int,
    db: Session = Depends(get_db)
):
    record = get_reference_by_id(db, reference_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found"
        )
    return record
 
 
# -------------------- UPDATE (PUT) --------------------
@router.put(
    "/{reference_id}",
    response_model=HTWStandardUncertaintyReferenceResponse,
    status_code=status.HTTP_200_OK
)
def update_htw_standard_uncertainty_reference(
    reference_id: int,
    payload: HTWStandardUncertaintyReferenceUpdate,
    db: Session = Depends(get_db)
):
    updated_record = update_reference(db, reference_id, payload)
   
    if not updated_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found"
        )
   
    return updated_record
 
 
# -------------------- DELETE --------------------
@router.delete(
    "/{reference_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_htw_standard_uncertainty_reference(
    reference_id: int,
    db: Session = Depends(get_db)
):
    success = delete_reference(db, reference_id)
   
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference not found"
        )
   
    return Response(status_code=status.HTTP_204_NO_CONTENT)