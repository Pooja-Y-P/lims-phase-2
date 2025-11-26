"""
Portal routes for customer access to FIR and inward data.
Handles both authenticated customer access and direct token-based access.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from backend import models 
from backend.db import get_db
from backend.services.customer_services import CustomerPortalService
from backend.auth import get_current_user
from backend.schemas.user_schemas import UserResponse
from backend.schemas.customer_schemas import (
    RemarksSubmissionRequest, 
    InwardForCustomer,
    AccountActivationRequest
)
from backend.schemas.srf_schemas import SrfApiResponse, SrfResponse
from backend.schemas.customer_schemas import CustomerDropdownResponse

router = APIRouter(prefix="/portal", tags=["Customer Portal"])
logger = logging.getLogger(__name__)

def get_customer_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Ensure the user is a customer and has an associated customer_id."""
    if not current_user or current_user.role.lower() != 'customer':
        raise HTTPException(status_code=403, detail="Customer access required")
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="User is not associated with a customer account.")
    return current_user


# --- Schemas ---
class SrfStatusUpdateRequest(BaseModel):
    status: str
    remarks: Optional[str] = None

class FirStatusUpdateRequest(BaseModel):
    status: str
    remarks: Optional[str] = None


# --- SRF ENDPOINTS ---

@router.get("/srfs", response_model=SrfApiResponse)
async def get_customer_srfs(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user)
):
    service = CustomerPortalService(db)
    return service.get_srfs_for_customer(current_user.customer_id)

@router.put("/srfs/{srf_id}/status", response_model=SrfResponse)
async def update_srf_status_by_customer(
    srf_id: int,
    request: SrfStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user),
):
    service = CustomerPortalService(db)
    return await service.update_srf_status(
        srf_id=srf_id,
        customer_id=current_user.customer_id,
        new_status=request.status,
        remarks=request.remarks,
    )


# --- FIR ENDPOINTS ---

@router.get("/firs-for-review", response_model=List[InwardForCustomer])
async def get_firs_for_customer_review_list(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user)
):
    service = CustomerPortalService(db)
    return service.get_firs_for_customer_list(current_user.customer_id)


@router.get("/firs/{inward_id}", response_model=InwardForCustomer)
async def get_fir_for_review(
    inward_id: int, 
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(get_customer_user)
):
    service = CustomerPortalService(db)
    fir_details = service.get_fir_for_customer_review(inward_id, current_user.customer_id)
    
    if not fir_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="FIR not found or you do not have permission to view it."
        )
    return fir_details


@router.put("/firs/{inward_id}/status")
async def update_fir_status(
    inward_id: int,
    request: FirStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user)
):
    """
    Allows a customer to update FIR status.
    Valid statuses: 'approved', 'rejected', 'reviewed'.
    """
    # 1. Fetch the inward record
    inward = db.query(models.Inward).filter(models.Inward.inward_id == inward_id).first()

    # 2. Validation
    if not inward:
        raise HTTPException(status_code=404, detail="FIR not found")
    
    if inward.customer_id != current_user.customer_id:
        raise HTTPException(status_code=404, detail="FIR not found") 

    # 3. Update Logic
    # Clean input: trim whitespace and convert to lowercase
    status_input = request.status.strip().lower()
    
    valid_statuses = ["created", "updated", "reviewed"]
    
    print(f"DEBUG: Updating FIR {inward_id} status. Received: '{status_input}'. Allowed: {valid_statuses}") # Console Log for debugging

    if status_input not in valid_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status '{request.status}'. Allowed values: {valid_statuses}"
        )

    inward.status = status_input
    
    # Safely update remarks if the column exists on the model
    # (This prevents 500 errors if the DB schema doesn't have a customer_remarks column on Inward table)
    if hasattr(inward, 'customer_remarks'):
        inward.customer_remarks = request.remarks
    elif request.remarks:
        print("WARNING: 'customer_remarks' field not found on Inward model. Remarks were not saved.")

    try:
        db.commit()
        db.refresh(inward)
        return {"message": f"FIR marked as {status_input}", "inward_id": inward_id}
    except Exception as e:
        db.rollback()
        print(f"DB Error during status update: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/firs/{inward_id}/remarks")
async def submit_fir_remarks(
    inward_id: int, 
    request: RemarksSubmissionRequest, 
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(get_customer_user)
):
    service = CustomerPortalService(db)
    return service.submit_customer_remarks(inward_id, request, current_user.customer_id)


# --- DIRECT ACCESS & ACCOUNT ACTIVATION ENDPOINTS ---

@router.get("/direct-fir/{inward_id}", response_model=InwardForCustomer)
async def get_fir_direct_access(
    inward_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = CustomerPortalService(db)
    fir_details = service.get_fir_for_direct_access(inward_id, token)
    
    if not fir_details:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="FIR not found or invalid token."
        )
    return fir_details

@router.post("/direct-fir/{inward_id}/remarks")
async def submit_fir_remarks_direct(
    inward_id: int,
    request: RemarksSubmissionRequest,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = CustomerPortalService(db)
    return service.submit_remarks_direct_access(inward_id, request, token)

@router.post("/activate-account")
async def activate_customer_account(
    request: AccountActivationRequest,
    db: Session = Depends(get_db)
):
    service = CustomerPortalService(db)
    token = service.activate_account_and_set_password(request.token, request.password)
    return {"access_token": token, "token_type": "bearer"}

@router.get("/customers/dropdown", response_model=List[CustomerDropdownResponse])
async def get_customers_for_dropdown(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    service = CustomerPortalService(db)
    return service.get_all_customers_for_dropdown()