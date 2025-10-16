from typing import List
from datetime import date
from fastapi import (
    APIRouter, Depends, status, HTTPException, Request, 
    Body, Form, UploadFile, BackgroundTasks
)
from sqlalchemy.orm import Session
import json

# Local imports
from backend.db import get_db
from backend.services.inward_services import InwardService
from backend.schemas.inward_schemas import InwardCreate, InwardResponse
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as UserSchema

ALLOWED_ROLES = ["staff", "admin", "engineer"] 
router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    """Dependency to authorize that the user has a permitted staff role."""
    if current_user.role.lower() not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation forbidden: Insufficient privileges."
        )
    return current_user

# -----------------------
# 1. POST / (Create Inward with Photos)
# -----------------------
@router.post(
    "/", 
    response_model=InwardResponse, 
    status_code=status.HTTP_201_CREATED,
    name="Create New Inward with Photos"
)
async def create_inward_with_photos(
    request: Request,
    srf_no: int = Form(...),
    date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Receives multipart/form-data to create an inward, its equipment, and save associated photos."""
    try:
        inward_data = InwardCreate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=equipment_list 
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail=f"Error validating form data: {e}"
        )

    form_data = await request.form()
    photos_by_index: dict[int, list[UploadFile]] = {}
    for key, value in form_data.items():
        if key.startswith("photos_") and isinstance(value, UploadFile) and value.filename:
            try:
                index = int(key.split("_")[1])
                if index not in photos_by_index:
                    photos_by_index[index] = []
                photos_by_index[index].append(value)
            except (ValueError, IndexError):
                continue

    inward_service = InwardService(db)
    
    # This call will now succeed because the method exists in the service
    db_inward = await inward_service.create_inward_with_files(
        inward_data=inward_data, 
        files_by_index=photos_by_index, 
        creator_id=current_user.user_id
    )
    
    response_data = InwardResponse.from_orm(db_inward)
    if db_inward.receiver:
        response_data.receiver_name = db_inward.receiver.full_name
    if db_inward.customer:
        response_data.customer_name = db_inward.customer.customer_details
    
    return response_data

# -----------------------
# 2. GET / (Get All Inward Records)
# -----------------------
@router.get("/", response_model=List[InwardResponse], name="Get All Inward Records")
def get_all_inward_records(
    db: Session = Depends(get_db), 
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    return inward_service.get_all_inwards()

# -----------------------
# 3. GET /{inward_id} (Get Inward by ID)
# -----------------------
@router.get("/{inward_id}", response_model=InwardResponse, name="Get Inward by ID")
def get_inward_by_id(
    inward_id: int, 
    db: Session = Depends(get_db), 
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    return inward_service.get_inward_by_id(inward_id)

# -----------------------
# 4. POST /{inward_id}/send-report (Send Customer Invitation/Notification)
# -----------------------
@router.post("/{inward_id}/send-report", status_code=status.HTTP_200_OK, name="Send Customer Feedback Request")
async def send_customer_feedback_request(
    inward_id: int,
    background_tasks: BackgroundTasks,
    email: str = Body(..., embed=True, description="The customer's email address."),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Initiates the customer feedback process by sending an email."""
    inward_service = InwardService(db)
    return await inward_service.process_customer_notification(
        inward_id=inward_id,
        customer_email=email,
        creator_id=current_user.user_id,
        background_tasks=background_tasks
    )