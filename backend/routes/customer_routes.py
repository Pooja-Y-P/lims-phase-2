from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend import models
from backend.schemas.srf_schemas import SrfResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from backend.db import get_db
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as AuthenticatedUser
from backend.schemas.customer_schemas import (
    AccountActivationRequest,
    RemarksSubmissionRequest,
    CustomerInwardListResponse,
    InwardForCustomer
)
from backend.schemas.user_schemas import Token as TokenResponse # Use your existing Token schema
from backend.services.customer_services import CustomerPortalService
from backend.auth import get_current_user  # Make sure this returns the logged-in user

router = APIRouter(prefix="/portal", tags=["Customer Portal"])

def require_customer_role(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Dependency to authorize that the logged-in user has the 'customer' role."""
    if not current_user or current_user.role.lower() != 'customer':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: requires customer privileges."
        )
    return current_user

# --- Public Endpoints (No Auth Required) ---

@router.post("/activate-account", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def activate_new_customer_account(
    payload: AccountActivationRequest,
    db: Session = Depends(get_db)
):
    """Activates a new customer account using an invitation token and returns a login token."""
    service = CustomerPortalService(db)
    access_token = service.activate_account_and_set_password(
        token=payload.token,
        new_password=payload.password
    )
    return {"access_token": access_token, "token_type": "bearer"}

# --- Authenticated Customer Endpoints ---

@router.get("/inwards", response_model=CustomerInwardListResponse)
def get_customer_inwards_list(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_customer_role)
):
    """Retrieves a list of all inwards associated with the logged-in customer."""
    service = CustomerPortalService(db)
    # The user model should have customer_id available if they are a customer
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="User is not associated with a customer account.")
        
    inwards_data = service.get_customer_inwards(current_user.customer_id)
    return CustomerInwardListResponse(inwards=inwards_data)
    
@router.get("/inwards/{inward_id}", response_model=InwardForCustomer)
def get_customer_inward_details(
    inward_id: int,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_customer_role)
):
    """Retrieves the full details of a specific inward for the logged-in customer."""
    service = CustomerPortalService(db)
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="User is not associated with a customer account.")
        
    inward = service.get_customer_inward_details(inward_id, current_user.customer_id)
    return inward

@router.post("/inwards/{inward_id}/remarks", status_code=status.HTTP_200_OK)
def submit_inward_remarks(
    inward_id: int,
    payload: RemarksSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_customer_role)
):
    """Submits customer remarks for the equipment within a specific inward."""
    service = CustomerPortalService(db)
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="User is not associated with a customer account.")
        
    service.submit_equipment_remarks(inward_id, payload, current_user.customer_id)
    return {"message": "Remarks have been submitted successfully."}

router = APIRouter(
    prefix="/customer",
    tags=["Customer"]
)

# Helper to fetch SRFs for a customer
def get_customer_srfs(customer_id: int, db: Session) -> List[models.Srf]:
    return db.query(models.Srf).join(
        models.Inward, models.Srf.inward_id == models.Inward.inward_id
    ).options(
        joinedload(models.Srf.inward).joinedload(models.Inward.customer)
    ).filter(
        models.Inward.customer_id == customer_id
    ).order_by(models.Srf.srf_id.desc()).all()


@router.get("/srfs", response_model=dict)
def fetch_customer_srfs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch SRFs for the logged-in customer.
    Categorize them into pending, approved, rejected.
    """
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="This user is not associated with a customer.")

    try:
        srfs = get_customer_srfs(current_user.customer_id, db)

        pending = []
        approved = []
        rejected = []

        for srf in srfs:
            customer_name = srf.inward.customer.customer_details if srf.inward and srf.inward.customer else None
            srf_data = SrfResponse(
                srf_id=srf.srf_id,
                srf_no=srf.srf_no,
                nepl_srf_no=srf.nepl_srf_no,
                status=srf.status,
                created_at=srf.created_at,
                inward_id=srf.inward_id,
                customer_name=customer_name
            )

            # Categorize based on status
            if srf.status == "inward-completed":
                pending.append(srf_data)
            elif srf.status == "approved":
                approved.append(srf_data)
            elif srf.status == "rejected":
                rejected.append(srf_data)

        return {
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        }

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
