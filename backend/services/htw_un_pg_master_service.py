#htw_un_pg_master_service.py
from sqlalchemy.orm import Session
from datetime import date
 
from backend.models.htw_un_pg_master import HTWUnPGMaster
from backend.schemas.htw_un_pg_master_schema import (
    HTWUnPGMasterCreate,
    HTWUnPGMasterUpdate
)
 
 
def create_un_pg_master(
    db: Session,
    payload: HTWUnPGMasterCreate
) -> HTWUnPGMaster:
    obj = HTWUnPGMaster(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
 
 
def get_all_un_pg_masters(db: Session):
    return (
        db.query(HTWUnPGMaster)
        .order_by(HTWUnPGMaster.set_pressure_min.asc())
        .all()
    )
 
 
def get_un_pg_master_by_id(db: Session, record_id: int):
    return (
        db.query(HTWUnPGMaster)
        .filter(HTWUnPGMaster.id == record_id)
        .first()
    )
 
 
def get_applicable_un_pg(
    db: Session,
    set_pressure: float,
    as_of_date: date
):
    """
    Used later during uncertainty calculation
    """
    return (
        db.query(HTWUnPGMaster)
        .filter(
            HTWUnPGMaster.is_active.is_(True),
            HTWUnPGMaster.set_pressure_min <= set_pressure,
            HTWUnPGMaster.set_pressure_max >= set_pressure,
            HTWUnPGMaster.valid_upto >= as_of_date
        )
        .order_by(HTWUnPGMaster.valid_upto.asc())
        .first()
    )
 
 
def update_un_pg_master(
    db: Session,
    record_id: int,
    payload: HTWUnPGMasterUpdate
):
    obj = get_un_pg_master_by_id(db, record_id)
    if not obj:
        return None
 
    for key, value in payload.dict(exclude_unset=True).items():
        setattr(obj, key, value)
 
    db.commit()
    db.refresh(obj)
    return obj
 
 
def deactivate_un_pg_master(db: Session, record_id: int) -> bool:
    obj = get_un_pg_master_by_id(db, record_id)
    if not obj:
        return False
 
    obj.is_active = False
    db.commit()
    return True