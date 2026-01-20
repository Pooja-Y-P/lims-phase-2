#htw_const_coverage_factor_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
 
from backend.db import get_db
from backend.schemas.htw_const_coverage_factor_schema import (
    HTWConstCoverageFactorCreate,
    HTWConstCoverageFactorUpdate,
    HTWConstCoverageFactorResponse
)
from backend.services.htw_const_coverage_factor_service import (
    create_coverage_factor,
    get_all_coverage_factors,
    get_coverage_factor_by_id,
    update_coverage_factor,
    deactivate_coverage_factor
)
 
router = APIRouter(
    prefix="/htw/coverage-factor",
    tags=["HTW Master Coverage Factor for certificate"]
)
 
 
@router.post(
    "",
    response_model=HTWConstCoverageFactorResponse,
    status_code=status.HTTP_201_CREATED
)
def create_factor(
    payload: HTWConstCoverageFactorCreate,
    db: Session = Depends(get_db)
):
    return create_coverage_factor(db, payload)
 
 
@router.get(
    "",
    response_model=list[HTWConstCoverageFactorResponse]
)
def list_factors(db: Session = Depends(get_db)):
    return get_all_coverage_factors(db)
 
 
@router.get(
    "/{factor_id}",
    response_model=HTWConstCoverageFactorResponse
)
def get_factor(
    factor_id: int,
    db: Session = Depends(get_db)
):
    obj = get_coverage_factor_by_id(db, factor_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Coverage factor not found")
    return obj
 
 
@router.put(
    "/{factor_id}",
    response_model=HTWConstCoverageFactorResponse
)
def update_factor(
    factor_id: int,
    payload: HTWConstCoverageFactorUpdate,
    db: Session = Depends(get_db)
):
    obj = update_coverage_factor(db, factor_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Coverage factor not found")
    return obj
 
 
@router.delete(
    "/{factor_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def deactivate_factor(
    factor_id: int,
    db: Session = Depends(get_db)
):
    success = deactivate_coverage_factor(db, factor_id)
    if not success:
        raise HTTPException(status_code=404, detail="Coverage factor not found")
 