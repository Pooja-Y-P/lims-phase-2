#htw_t_distribution_router.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
 
from backend.db import get_db
from backend.schemas.htw_t_distribution_schema import (
    HTWTDistributionCreate,
    HTWTDistributionUpdate,
    HTWTDistributionResponse
)
from backend.services.htw_t_distribution_service import (
    create_t_distribution,
    get_t_distribution_by_id,
    list_t_distributions,
    update_t_distribution,
    soft_delete_t_distribution
)
 
router = APIRouter(
    prefix="/admin/t-distribution",
    tags=["HTW Master student T table or T Distribution"]
)
 
 
@router.post(
    "",
    response_model=HTWTDistributionResponse
)
def create_record(
    payload: HTWTDistributionCreate,
    db: Session = Depends(get_db)
):
    return create_t_distribution(db, payload)
 
 
@router.get(
    "",
    response_model=List[HTWTDistributionResponse]
)
def list_records(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    return list_t_distributions(db, active_only)
 
 
@router.get(
    "/{record_id}",
    response_model=HTWTDistributionResponse
)
def get_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    return get_t_distribution_by_id(db, record_id)
 
 
@router.put(
    "/{record_id}",
    response_model=HTWTDistributionResponse
)
def update_record(
    record_id: int,
    payload: HTWTDistributionUpdate,
    db: Session = Depends(get_db)
):
    return update_t_distribution(db, record_id, payload)
 
 
@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    soft_delete_t_distribution(db, record_id)
    return {"status": "success"}
 
 