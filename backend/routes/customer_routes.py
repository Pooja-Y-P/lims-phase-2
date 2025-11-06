"""
Portal routes for customer access to FIR and inward data.
Handles both authenticated customer access and direct token-based access.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging

from backend.db import get_db
from backend.services.customer_services import CustomerPortalService
from backend.auth import get_current_user
from backend.schemas.user_schemas import UserResponse
from backend.schemas.customer_schemas import (
    RemarksSubmissionRequest, 
    InwardForCustomer,
    AccountActivationRequest
)
from backend.schemas.srf_schemas import SrfApiResponse, SrfResponse # Import SrfResponse for the new endpoint


router = APIRouter(prefix="/portal", tags=["Customer Portal"])
logger = logging.getLogger(__name__)

def get_customer_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    """Ensure the user is a customer and has an associated customer_id."""
    if not current_user or current_user.role.lower() != 'customer':
        raise HTTPException(status_code=403, detail="Customer access required")
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="User is not associated with a customer account.")
    return current_user


# --- NEW: Schema for the status update payload ---
class SrfStatusUpdateRequest(BaseModel):
    status: str
    remarks: Optional[str] = None
    # You can add other fields the customer can edit here if needed
    # e.g., telephone: Optional[str] = None


# --- SRF ENDPOINTS ---

@router.get("/srfs", response_model=SrfApiResponse)
async def get_customer_srfs(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user)
):
    """Get all SRFs for the currently authenticated customer, categorized by status."""
    service = CustomerPortalService(db)
    return service.get_srfs_for_customer(current_user.customer_id)

# NEW: Endpoint for a customer to approve/reject an SRF
@router.put("/srfs/{srf_id}/status", response_model=SrfResponse)
async def update_srf_status_by_customer(
    srf_id: int,
    request: SrfStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user),
):
    """Allows a customer to approve or reject an SRF."""
    service = CustomerPortalService(db)
    return await service.update_srf_status(
        srf_id=srf_id,
        customer_id=current_user.customer_id,
        new_status=request.status,
        remarks=request.remarks,
        # Pass other editable fields as kwargs if your service method supports it
    )


# --- FIR ENDPOINTS ---

@router.get("/firs-for-review", response_model=List[InwardForCustomer])
async def get_firs_for_customer_review_list(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_customer_user)
):
    """Get a list of all FIRs needing review for the current customer."""
    service = CustomerPortalService(db)
    return service.get_firs_for_customer_list(current_user.customer_id)


@router.get("/firs/{inward_id}", response_model=InwardForCustomer)
async def get_fir_for_review(
    inward_id: int, 
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(get_customer_user)
):
    """Get details for a single FIR for authenticated customer review."""
    service = CustomerPortalService(db)
    return service.get_fir_for_customer_review(inward_id, current_user.customer_id)

@router.post("/firs/{inward_id}/remarks")
async def submit_fir_remarks(
    inward_id: int, 
    request: RemarksSubmissionRequest, 
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(get_customer_user)
):
    """Submit customer remarks for an FIR (authenticated)."""
    service = CustomerPortalService(db)
    return service.submit_customer_remarks(inward_id, request, current_user.customer_id)

# --- DIRECT ACCESS & ACCOUNT ACTIVATION ENDPOINTS ---

@router.get("/direct-fir/{inward_id}", response_model=InwardForCustomer)
async def get_fir_direct_access(
    inward_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get FIR details via a direct link from an email."""
    service = CustomerPortalService(db)
    return service.get_fir_for_direct_access(inward_id, token)

@router.post("/direct-fir/{inward_id}/remarks")
async def submit_fir_remarks_direct(
    inward_id: int,
    request: RemarksSubmissionRequest,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Submit customer remarks via a direct link."""
    service = CustomerPortalService(db)
    return service.submit_remarks_direct_access(inward_id, request, token)

@router.post("/activate-account")
async def activate_customer_account(
    request: AccountActivationRequest,
    db: Session = Depends(get_db)
):
    """Activate a customer account using an invitation token and set a password."""
    service = CustomerPortalService(db)
    token = service.activate_account_and_set_password(request.token, request.password)
    return {"access_token": token, "token_type": "bearer"}