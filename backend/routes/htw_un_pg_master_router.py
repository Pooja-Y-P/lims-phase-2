#htw_un_pg_master_router.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
 
from backend.db import get_db
from backend.schemas.htw_un_pg_master_schema import (
    HTWUnPGMasterCreate,
    HTWUnPGMasterUpdate,
    HTWUnPGMasterResponse
)
from backend.services.htw_un_pg_master_service import (
    create_un_pg_master,
    get_all_un_pg_masters,
    get_un_pg_master_by_id,
    update_un_pg_master,
    deactivate_un_pg_master
)
 
router = APIRouter(
    prefix="/htw/un-pg-master",
    tags=["HTW Master Uncertainity of pressure gaugeUn-PG"]
)
 
 
@router.post(
    "",
    response_model=HTWUnPGMasterResponse,
    status_code=status.HTTP_201_CREATED
)
def create_un_pg(
    payload: HTWUnPGMasterCreate,
    db: Session = Depends(get_db)
):
    return create_un_pg_master(db, payload)
 
 
@router.get(
    "",
    response_model=list[HTWUnPGMasterResponse]
)
def list_un_pg(db: Session = Depends(get_db)):
    return get_all_un_pg_masters(db)
 
 
@router.get(
    "/{record_id}",
    response_model=HTWUnPGMasterResponse
)
def get_un_pg(
    record_id: int,
    db: Session = Depends(get_db)
):
    obj = get_un_pg_master_by_id(db, record_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Un-PG record not found")
    return obj
 
 
@router.put(
    "/{record_id}",
    response_model=HTWUnPGMasterResponse
)
def update_un_pg(
    record_id: int,
    payload: HTWUnPGMasterUpdate,
    db: Session = Depends(get_db)
):
    obj = update_un_pg_master(db, record_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Un-PG record not found")
    return obj
 
 
@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def deactivate_un_pg(
    record_id: int,
    db: Session = Depends(get_db)
):
    success = deactivate_un_pg_master(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="Un-PG record not found")