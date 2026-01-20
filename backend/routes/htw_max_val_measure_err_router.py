from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
 
from backend.db import get_db
from backend.schemas.htw_max_val_measure_err_schema import (
    HTWMaxValMeasureErrCreate,
    HTWMaxValMeasureErrUpdate,
    HTWMaxValMeasureErrResponse
)
from backend.services.htw_max_val_measure_err_service import (
    create_max_val_measure_err,
    get_all_max_val_measure_err,
    get_active_max_val_measure_err,
    update_max_val_measure_err,
    soft_delete_max_val_measure_err
)
 
router = APIRouter(
    prefix="/htw/max-val-measure-err",
    tags=["HTW – Max Value of Measurement Error"]
)
 
 
@router.post(
    "",
    response_model=HTWMaxValMeasureErrResponse
)
def create_record(
    payload: HTWMaxValMeasureErrCreate,
    db: Session = Depends(get_db)
):
    try:
        return create_max_val_measure_err(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
 
 
@router.get(
    "",
    response_model=list[HTWMaxValMeasureErrResponse]
)
def get_all(db: Session = Depends(get_db)):
    return get_all_max_val_measure_err(db)
 
 
@router.get(
    "/active",
    response_model=list[HTWMaxValMeasureErrResponse]
)
def get_active(db: Session = Depends(get_db)):
    return get_active_max_val_measure_err(db)
 
 
@router.put(
    "/{record_id}",
    response_model=HTWMaxValMeasureErrResponse
)
def update_record(
    record_id: int,
    payload: HTWMaxValMeasureErrUpdate,
    db: Session = Depends(get_db)
):
    try:
        return update_max_val_measure_err(db, record_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
 
 
@router.delete("/{record_id}")
def deactivate_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    try:
        soft_delete_max_val_measure_err(db, record_id)
        return {"status": "success"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
 