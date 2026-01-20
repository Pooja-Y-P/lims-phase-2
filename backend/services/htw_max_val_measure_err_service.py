from sqlalchemy.orm import Session
from sqlalchemy import and_
 
from backend.models.htw_max_val_measure_err import HTWMaxValMeasureErr
from backend.schemas.htw_max_val_measure_err_schema import (
    HTWMaxValMeasureErrCreate,
    HTWMaxValMeasureErrUpdate
)
 
 
def create_max_val_measure_err(
    db: Session,
    payload: HTWMaxValMeasureErrCreate
):
    # Check overlapping ranges
    overlap = db.query(HTWMaxValMeasureErr).filter(
        and_(
            HTWMaxValMeasureErr.is_active.is_(True),
            payload.range_min <= HTWMaxValMeasureErr.range_max,
            payload.range_max >= HTWMaxValMeasureErr.range_min
        )
    ).first()
 
    if overlap:
        raise ValueError("Overlapping range already exists")
 
    record = HTWMaxValMeasureErr(**payload.dict())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
 
 
def get_all_max_val_measure_err(db: Session):
    return (
        db.query(HTWMaxValMeasureErr)
        .order_by(HTWMaxValMeasureErr.range_min.asc())
        .all()
    )
 
 
def get_active_max_val_measure_err(db: Session):
    return (
        db.query(HTWMaxValMeasureErr)
        .filter(HTWMaxValMeasureErr.is_active.is_(True))
        .order_by(HTWMaxValMeasureErr.range_min.asc())
        .all()
    )
 
 
def update_max_val_measure_err(
    db: Session,
    record_id: int,
    payload: HTWMaxValMeasureErrUpdate
):
    record = db.query(HTWMaxValMeasureErr).get(record_id)
 
    if not record:
        raise ValueError("Record not found")
 
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(record, field, value)
 
    db.commit()
    db.refresh(record)
    return record
 
 
def soft_delete_max_val_measure_err(db: Session, record_id: int):
    record = db.query(HTWMaxValMeasureErr).get(record_id)
 
    if not record:
        raise ValueError("Record not found")
 
    record.is_active = False
    db.commit()
 