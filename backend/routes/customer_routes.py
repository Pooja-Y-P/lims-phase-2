# file: backend/routes/customer_routes.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional

from backend import models
# FIX 1: The import now works because you added SrfResponse to the schemas file
from backend.schemas.srf_schemas import SrfResponse
from backend.db import get_db
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as AuthenticatedUser
from backend.schemas.customer_schemas import (
    AccountActivationRequest,
    RemarksSubmissionRequest,
    CustomerInwardListResponse,
    InwardForCustomer
)
from backend.schemas.user_schemas import Token as TokenResponse
from backend.services.customer_services import CustomerPortalService

# FIX 2: Define the router only ONCE. All endpoints in this file will use this instance.
router = APIRouter(prefix="/portal", tags=["Customer Portal"])

def require_customer_role(current_user: AuthenticatedUser = Depends(get_current_user)):
    """Dependency to authorize that the logged-in user has the 'customer' role."""
    if not current_user or current_user.role.lower() != 'customer':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: requires customer privileges."
        )
    return current_user

# --- Public Endpoints ---

@router.post("/activate-account", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def activate_new_customer_account(
    payload: AccountActivationRequest,
    db: Session = Depends(get_db)
):
    """Activates a new customer account and returns a login token."""
    service = CustomerPortalService(db)
    access_token = service.activate_account_and_set_password(
        token=payload.token,
        new_password=payload.password
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/direct/{inward_id}", response_model=InwardForCustomer)
def get_inward_details_direct_link(
    inward_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Allows direct access to inward details via a public link."""
    service = CustomerPortalService(db)
    inward = db.query(models.Inward).filter(models.Inward.inward_id == inward_id).first()
    if not inward:
        raise HTTPException(status_code=404, detail="Inward record not found.")
    
    if not token:
        raise HTTPException(
            status_code=401, 
            detail="Authentication required. Please login to view this report.",
            headers={"X-Redirect-Required": "true", "X-Inward-Id": str(inward_id)}
        )
    
    try:
        # In production, add token validation here
        return service.get_inward_details_for_direct_access(inward_id)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid access token. Please login to view this report.",
            headers={"X-Redirect-Required": "true", "X-Inward-Id": str(inward_id)}
        )

# --- Authenticated Customer Endpoints ---

@router.get("/inwards", response_model=CustomerInwardListResponse)
def get_customer_inwards_list(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_customer_role)
):
    """Retrieves a list of all inwards associated with the logged-in customer."""
    service = CustomerPortalService(db)
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

# Helper to fetch SRFs for a customer (can be moved into a service if desired)
def get_customer_srfs_from_db(customer_id: int, db: Session) -> List[models.Srf]:
    return db.query(models.Srf).join(
        models.Inward, models.Srf.inward_id == models.Inward.inward_id
    ).options(
        joinedload(models.Srf.inward).joinedload(models.Inward.customer)
    ).filter(
        models.Inward.customer_id == customer_id
    ).order_by(models.Srf.srf_id.desc()).all()


# FIX 3: This endpoint is now correctly part of the main router.
# The URL will be `/portal/srfs`
@router.get("/srfs", response_model=dict)
def fetch_customer_srfs(
    db: Session = Depends(get_db),
    current_user: AuthenticatedUser = Depends(require_customer_role)
):
    """
    Fetch SRFs for the logged-in customer, categorized by status.
    """
    if not current_user.customer_id:
        raise HTTPException(status_code=403, detail="This user is not associated with a customer.")

    try:
        srfs = get_customer_srfs_from_db(current_user.customer_id, db)

        pending = []
        approved = []
        rejected = []

        for srf in srfs:
            customer_name = srf.inward.customer.customer_details if srf.inward and srf.inward.customer else None
            
            # This instantiation now works correctly
            srf_data = SrfResponse(
                srf_id=srf.srf_id,
                srf_no=srf.srf_no,
                nepl_srf_no=srf.nepl_srf_no,
                status=srf.status,
                created_at=srf.created_at,
                inward_id=srf.inward_id,
                customer_name=customer_name,
                # Ensure all required fields from the ORM model are passed
                calibration_frequency=srf.calibration_frequency,
                statement_of_conformity=srf.statement_of_conformity,
                remarks=srf.remarks
            )

            # Categorize based on status
            if srf.status == "inward-completed":
                pending.append(srf_data)
            elif srf.status == "approved":
                approved.append(srf_data)
            elif srf.status == "rejected":
                rejected.append(srf_data)
            # You might want to handle other statuses as well

        return {
            "pending": pending,
            "approved": approved,
            "rejected": rejected
        }

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")