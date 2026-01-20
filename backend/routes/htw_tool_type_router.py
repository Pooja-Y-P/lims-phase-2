from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
 
from backend.db import get_db
from backend.schemas.htw_tool_type_schema import (
    HTWToolTypeCreate,
    HTWToolTypeUpdate,
    HTWToolTypeResponse
)
from backend.services.htw_tool_type_service import (
    create_tool_type,
    get_all_tool_types,
    get_tool_type_by_id,
    update_tool_type,
    deactivate_tool_type
)
 
router = APIRouter(
    prefix="/htw/tool-types",
    tags=["HTW Tool Type Master"]
)
 
 
@router.post("", response_model=HTWToolTypeResponse)
def create(payload: HTWToolTypeCreate, db: Session = Depends(get_db)):
    return create_tool_type(db, payload)
 
 
@router.get("", response_model=list[HTWToolTypeResponse])
def list_all(db: Session = Depends(get_db)):
    return get_all_tool_types(db)
 
 
@router.get("/{tool_id}", response_model=HTWToolTypeResponse)
def get_by_id(tool_id: int, db: Session = Depends(get_db)):
    obj = get_tool_type_by_id(db, tool_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Tool type not found")
    return obj
 
 
@router.put("/{tool_id}", response_model=HTWToolTypeResponse)
def update(
    tool_id: int,
    payload: HTWToolTypeUpdate,
    db: Session = Depends(get_db)
):
    obj = update_tool_type(db, tool_id, payload)
    if not obj:
        raise HTTPException(status_code=404, detail="Tool type not found")
    return obj
 
 
@router.delete("/{tool_id}")
def deactivate(tool_id: int, db: Session = Depends(get_db)):
    success = deactivate_tool_type(db, tool_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tool type not found")
    return {"status": "deactivated"}
 