from sqlalchemy.orm import Session
from backend.models.htw_tool_type import HTWToolType
from backend.schemas.htw_tool_type_schema import (
    HTWToolTypeCreate,
    HTWToolTypeUpdate
)
 
 
# -----------------------
# CREATE
# -----------------------
def create_tool_type(db: Session, payload: HTWToolTypeCreate):
    obj = HTWToolType(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj
 
 
# -----------------------
# READ ALL
# -----------------------
def get_all_tool_types(db: Session):
    return (
        db.query(HTWToolType)
        .order_by(
            HTWToolType.tool_category.asc(),
            HTWToolType.tool_name.asc()
        )
        .all()
    )
 
 
# -----------------------
# READ BY ID
# -----------------------
def get_tool_type_by_id(db: Session, tool_id: int):
    return (
        db.query(HTWToolType)
        .filter(HTWToolType.id == tool_id)
        .first()
    )
 
 
# -----------------------
# UPDATE
# -----------------------
def update_tool_type(
    db: Session,
    tool_id: int,
    payload: HTWToolTypeUpdate
):
    obj = get_tool_type_by_id(db, tool_id)
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
def deactivate_tool_type(db: Session, tool_id: int) -> bool:
    obj = get_tool_type_by_id(db, tool_id)
    if not obj:
        return False
 
    obj.is_active = False
    db.commit()
    return True
 