from sqlalchemy.orm import Session
from typing import List, Optional
 
from backend.models.htw_standard_uncertainty_reference import (
    HTWStandardUncertaintyReference
)
from backend.schemas.htw_standard_uncertainty_reference_schemas import (
    HTWStandardUncertaintyReferenceCreate,
    HTWStandardUncertaintyReferenceUpdate
)
 
 
def create_reference(
    db: Session,
    data: HTWStandardUncertaintyReferenceCreate
) -> HTWStandardUncertaintyReference:
    record = HTWStandardUncertaintyReference(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
 
 
def get_references(
    db: Session,
    is_active: Optional[bool] = None,
    torque_nm: Optional[int] = None
) -> List[HTWStandardUncertaintyReference]:
    query = db.query(HTWStandardUncertaintyReference)
 
    if is_active is not None:
        query = query.filter(
            HTWStandardUncertaintyReference.is_active == is_active
        )
 
    if torque_nm is not None:
        query = query.filter(
            HTWStandardUncertaintyReference.torque_nm == torque_nm
        )
 
    return query.order_by(
        HTWStandardUncertaintyReference.created_at.desc()
    ).all()
 
 
def get_reference_by_id(
    db: Session,
    reference_id: int
) -> HTWStandardUncertaintyReference | None:
    return (
        db.query(HTWStandardUncertaintyReference)
        .filter(HTWStandardUncertaintyReference.id == reference_id)
        .first()
    )
 
 
def update_reference(
    db: Session,
    reference_id: int,
    data: HTWStandardUncertaintyReferenceUpdate
) -> HTWStandardUncertaintyReference | None:
    record = get_reference_by_id(db, reference_id)
    if not record:
        return None
 
    # exclude_unset=True ensures we only update fields that were actually sent
    update_data = data.model_dump(exclude_unset=True)
 
    for key, value in update_data.items():
        setattr(record, key, value)
 
    db.commit()
    db.refresh(record)
    return record
 
 
def delete_reference(
    db: Session,
    reference_id: int
) -> bool:
    record = get_reference_by_id(db, reference_id)
    if not record:
        return False
 
    db.delete(record)
    db.commit()
    return True
 