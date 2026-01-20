#htw_t_distribution_service.py
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
 
from backend.models.htw_t_distribution import HTWTDistribution
from backend.schemas.htw_t_distribution_schema import (
    HTWTDistributionCreate,
    HTWTDistributionUpdate
)
 
 
def create_t_distribution(
    db: Session,
    payload: HTWTDistributionCreate
) -> HTWTDistribution:
    try:
        record = HTWTDistribution(**payload.dict())
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
 
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="T-distribution entry already exists for given DF and confidence level"
        )
 
 
def get_t_distribution_by_id(
    db: Session,
    record_id: int
) -> HTWTDistribution:
    record = (
        db.query(HTWTDistribution)
        .filter(HTWTDistribution.id == record_id)
        .first()
    )
 
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="T-distribution record not found"
        )
 
    return record
 
 
def list_t_distributions(
    db: Session,
    active_only: bool = True
):
    query = db.query(HTWTDistribution)
 
    if active_only:
        query = query.filter(HTWTDistribution.is_active.is_(True))
 
    return query.order_by(
        HTWTDistribution.degrees_of_freedom.asc(),
        HTWTDistribution.confidence_level.asc()
    ).all()
 
 
def update_t_distribution(
    db: Session,
    record_id: int,
    payload: HTWTDistributionUpdate
) -> HTWTDistribution:
    record = get_t_distribution_by_id(db, record_id)
 
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(record, field, value)
 
    try:
        db.commit()
        db.refresh(record)
        return record
 
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Duplicate T-distribution entry after update"
        )
 
 
def soft_delete_t_distribution(
    db: Session,
    record_id: int
):
    record = get_t_distribution_by_id(db, record_id)
    record.is_active = False
    db.commit()