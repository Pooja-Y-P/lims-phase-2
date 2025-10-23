# backend/routes/srf_router.py

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as UserSchema
from backend.services.srf_services import SrfService

ALLOWED_ROLES = ["staff", "admin", "engineer"] 
router = APIRouter(prefix="/staff/srfs", tags=["SRF Management"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    """Dependency to authorize that the user has a permitted staff role."""
    if current_user.role.lower() not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation forbidden: Insufficient privileges."
        )
    return current_user

@router.get("/reviewed-inwards", response_model=List[Dict[str, Any]])
def get_reviewed_inwards_for_srf(
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Get inwards with 'reviewed' status ready for SRF creation"""
    srf_service = SrfService(db)
    return srf_service.get_reviewed_inwards()

@router.post("/create-from-inward/{inward_id}", status_code=status.HTTP_201_CREATED)
def create_srf_from_inward(
    inward_id: int,
    srf_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Create SRF from reviewed inward"""
    srf_service = SrfService(db)
    srf = srf_service.create_srf_from_inward(inward_id, srf_data)
    return {
        "message": f"SRF {srf.srf_no} created successfully",
        "srf_id": srf.srf_id
    }

@router.get("/{srf_id}", response_model=Dict[str, Any])
def get_srf_details(
    srf_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Get SRF details with equipment information"""
    srf_service = SrfService(db)
    return srf_service.get_srf_by_id(srf_id)

@router.put("/{srf_id}", status_code=status.HTTP_200_OK)
def update_srf(
    srf_id: int,
    update_data: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Update SRF details"""
    from backend.models.srfs import Srf
    
    srf = db.get(Srf, srf_id)
    if not srf:
        raise HTTPException(status_code=404, detail="SRF not found")
    
    # Update SRF fields
    for field, value in update_data.items():
        if hasattr(srf, field):
            setattr(srf, field, value)
    
    db.commit()
    
    return {"message": "SRF updated successfully"}