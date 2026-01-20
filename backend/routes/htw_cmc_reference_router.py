from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
 
from backend.db import get_db
from backend.schemas.htw_cmc_reference_schema import (
    HTWCMCReferenceCreate,
    HTWCMCReferenceUpdate,
    HTWCMCReferenceResponse
)
from backend.services.htw_cmc_reference_service import (
    create_cmc_reference,
    get_all_cmc_references,
    get_cmc_reference_by_id,
    update_cmc_reference,
    deactivate_cmc_reference
)
 
router = APIRouter(
    prefix="/htw/cmc",
    tags=["HTW Scope – Hydraulic CMC Backup Data"]
)
 
 
@router.post("", response_model=HTWCMCReferenceResponse)
def create(payload: HTWCMCReferenceCreate, db: Session = Depends(get_db)):
    return create_cmc_reference(db, payload)
 
 
@router.get("", response_model=list[HTWCMCReferenceResponse])
def list_all(db: Session = Depends(get_db)):
    return get_all_cmc_references(db)
 
 
@router.get("/{record_id}", response_model=HTWCMCReferenceResponse)
def get_by_id(record_id: int, db: Session = Depends(get_db)):
    obj = get_cmc_reference_by_id(db, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail="CMC reference not found")
    return obj
 
 
@router.put("/{record_id}", response_model=HTWCMCReferenceResponse)
def update(
    record_id: int,
    payload: HTWCMCReferenceUpdate,
    db: Session = Depends(get_db)
):
    obj = update_cmc_reference(db, record_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="CMC reference not found")
    return obj
 
 
@router.delete("/{record_id}")
def deactivate(record_id: int, db: Session = Depends(get_db)):
    success = deactivate_cmc_reference(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="CMC reference not found")
    return {"status": "deactivated"}