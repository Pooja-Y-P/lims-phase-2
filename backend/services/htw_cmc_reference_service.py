from sqlalchemy.orm import Session
from backend.models.htw_cmc_reference import HTWCMCReference
from backend.schemas.htw_cmc_reference_schema import (
    HTWCMCReferenceCreate,
    HTWCMCReferenceUpdate
)
 
 
# -----------------------
# CREATE
# -----------------------
def create_cmc_reference(db: Session, payload: HTWCMCReferenceCreate):
    obj = HTWCMCReference(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
 
 
# -----------------------
# READ ALL
# -----------------------
def get_all_cmc_references(db: Session):
    return (
        db.query(HTWCMCReference)
        .order_by(HTWCMCReference.lower_measure_range.asc())
        .all()
    )
 
 
# -----------------------
# READ BY ID
# -----------------------
def get_cmc_reference_by_id(db: Session, record_id: int):
    return (
        db.query(HTWCMCReference)
        .filter(HTWCMCReference.id == record_id)
        .first()
    )
 
 
# -----------------------
# BUSINESS USE (IMPORTANT)
# Used during uncertainty / CMC calculation
# -----------------------
def get_applicable_cmc(db: Session, applied_value: float):
    return (
        db.query(HTWCMCReference)
        .filter(
            HTWCMCReference.is_active.is_(True),
            HTWCMCReference.lower_measure_range <= applied_value,
            HTWCMCReference.higher_measure_range >= applied_value
        )
        .order_by(HTWCMCReference.higher_measure_range.asc())
        .first()
    )
 
 
# -----------------------
# UPDATE
# -----------------------
def update_cmc_reference(
    db: Session,
    record_id: int,
    payload: HTWCMCReferenceUpdate
):
    obj = get_cmc_reference_by_id(db, record_id)
    if not obj:
        return None
 
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(obj, key, value)
 
    db.commit()
    db.refresh(obj)
    return obj
 
 
# -----------------------
# SOFT DELETE
# -----------------------
def deactivate_cmc_reference(db: Session, record_id: int) -> bool:
    obj = get_cmc_reference_by_id(db, record_id)
    if not obj:
        return False
 
    obj.is_active = False
    db.commit()
    return True