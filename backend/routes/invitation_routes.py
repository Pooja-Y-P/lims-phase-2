# backend/routes/invitation_routes.py

from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.user_schemas import InvitationRequest, UserResponse
from backend.services.invitation_service import InvitationService
from backend.auth import get_current_user

router = APIRouter(
    prefix="/invitations",
    tags=["Invitations"]
)


# -------------------- Routes --------------------

@router.post("/send", response_model=dict)
async def send_invitation(
    invitation_request: InvitationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Send an invitation to a new user.
    Only active users can send invitations.
    """
    invitation_service = InvitationService(db)
    try:
        # Await the async service method
        # UPDATED: Passing ship_to_address and bill_to_address instead of generic company_address
        result = await invitation_service.create_invitation(
            email=invitation_request.email,
            role=invitation_request.role,
            invited_name=invitation_request.invited_name,
            company_name=invitation_request.company_name,
            ship_to_address=invitation_request.ship_to_address,
            bill_to_address=invitation_request.bill_to_address,
            phone_number=invitation_request.phone_number,
            created_by=current_user.user_id,
            background_tasks=background_tasks,
            customer_id=invitation_request.customer_id
        )
        return result
    except HTTPException as e:
        raise e


@router.post("/accept", response_model=UserResponse)
async def accept_invitation(
    token: str,
    new_password: str,
    db: Session = Depends(get_db)
):
    """
    Accept an invitation using the token and set a new password.
    """
    invitation_service = InvitationService(db)
    try:
        # Await the async service method
        user = await invitation_service.accept_invitation(
            token=token,
            new_password=new_password
        )
        return user
    except HTTPException as e:
        raise e