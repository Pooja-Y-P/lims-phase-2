#htw_const_coverage_factor_service.py
from sqlalchemy.orm import Session
from sqlalchemy import update
 
from backend.models.htw_const_coverage_factor import HTWConstCoverageFactor
from backend.schemas.htw_const_coverage_factor_schema import (
    HTWConstCoverageFactorCreate,
    HTWConstCoverageFactorUpdate
)
 
 
def create_coverage_factor(
    db: Session,
    payload: HTWConstCoverageFactorCreate
) -> HTWConstCoverageFactor:
    """
    Create a new coverage factor.
    Rule: Only ONE active coverage factor allowed.
    """
 
    if payload.is_active:
        # Deactivate existing active ones
        db.execute(
            update(HTWConstCoverageFactor)
            .where(HTWConstCoverageFactor.is_active.is_(True))
            .values(is_active=False)
        )
 
    obj = HTWConstCoverageFactor(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
 
 
def get_all_coverage_factors(db: Session):
    return (
        db.query(HTWConstCoverageFactor)
        .order_by(HTWConstCoverageFactor.created_at.desc())
        .all()
    )
 
 
def get_coverage_factor_by_id(db: Session, factor_id: int):
    return (
        db.query(HTWConstCoverageFactor)
        .filter(HTWConstCoverageFactor.id == factor_id)
        .first()
    )
 
 
def update_coverage_factor(
    db: Session,
    factor_id: int,
    payload: HTWConstCoverageFactorUpdate
):
    obj = get_coverage_factor_by_id(db, factor_id)
    if not obj:
        return None
 
    data = payload.dict(exclude_unset=True)
 
    if data.get("is_active") is True:
        # Ensure single active record
        db.execute(
            update(HTWConstCoverageFactor)
            .where(
                HTWConstCoverageFactor.is_active.is_(True),
                HTWConstCoverageFactor.id != factor_id
            )
            .values(is_active=False)
        )
 
    for key, value in data.items():
        setattr(obj, key, value)
 
    db.commit()
    db.refresh(obj)
    return obj
 
 
def deactivate_coverage_factor(db: Session, factor_id: int) -> bool:
    obj = get_coverage_factor_by_id(db, factor_id)
    if not obj:
        return False
 
    obj.is_active = False
    db.commit()
    return True
 