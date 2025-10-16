# backend/routes/inward_routes.py

from typing import List
from fastapi import APIRouter, Depends, status, HTTPException, Request, Body, Form
from sqlalchemy.orm import Session
import json

# Local imports
from backend.db import get_db
from backend.services.inward_services import InwardService
from backend.schemas.inward_schemas import InwardCreate, InwardResponse
from backend.auth import get_current_user
from backend.schemas.user_schemas import UserResponse

ALLOWED_ROLES = ["staff", "admin", "engineer"] 

router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserResponse = Depends(get_current_user)):
    """Dependency to authorize user roles."""
    if current_user.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation forbidden for this user role."
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
    date: str = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(check_staff_role)
):
    """Receives multipart/form-data to create an inward record, its equipment, and save photos."""
    try:
        # Parse equipment list from JSON string
        try:
            equipment_data = json.loads(equipment_list)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail="Invalid equipment_list JSON format"
            )

        # Create InwardCreate with parsed equipment data
        inward_data = InwardCreate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=equipment_data  # Pass parsed data directly
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
            detail=f"Form data validation error: {e}"
        )

    # Process files from the form data
    form_data = await request.form()
    photos_by_index = {}
    for key, value in form_data.items():
        if key.startswith("photos_"):
            try:
                index = int(key.split("_")[1])
                if index not in photos_by_index:
                    photos_by_index[index] = []
                if hasattr(value, 'filename'): 
                    photos_by_index[index].append(value)
            except (ValueError, IndexError):
                continue

    inward_service = InwardService(db)
    
    db_inward = await inward_service.create_inward_with_files(
        inward_data=inward_data, 
        files_by_index=photos_by_index, 
        creator_id=current_user.user_id
    )
    
    response_data = InwardResponse.from_orm(db_inward)
    response_data.receiver_name = db_inward.receiver.full_name if db_inward.receiver else "N/A"
    response_data.customer_name = db_inward.customer.customer_details if db_inward.customer else db_inward.customer_details
    
    return response_data

# -----------------------
# 2. GET / (Get All Inward Records)
# -----------------------
@router.get("/", response_model=List[InwardResponse], name="Get All Inward Records")
def get_all_inward_records(
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    all_inwards = inward_service.get_all_inwards()
    response_list = []
    for db_inward in all_inwards:
        response_data = InwardResponse.from_orm(db_inward)
        response_data.receiver_name = db_inward.receiver.full_name if db_inward.receiver else "N/A"
        response_data.customer_name = db_inward.customer.customer_details if db_inward.customer else db_inward.customer_details
        response_list.append(response_data)
    return response_list

# -----------------------
# 3. GET /{inward_id} (Get Inward by ID)
# -----------------------
@router.get("/{inward_id}", response_model=InwardResponse, name="Get Inward by ID")
def get_inward_by_id(
    inward_id: int, 
    db: Session = Depends(get_db), 
    current_user: UserResponse = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    db_inward = inward_service.get_inward_by_id(inward_id)
    response_data = InwardResponse.from_orm(db_inward)
    response_data.receiver_name = db_inward.receiver.full_name if db_inward.receiver else "N/A"
    response_data.customer_name = db_inward.customer.customer_details if db_inward.customer else db_inward.customer_details
    return response_data

# -----------------------
# 4. POST /{inward_id}/send-report (Send First Inspection Report)
# -----------------------
@router.post("/{inward_id}/send-report", status_code=status.HTTP_200_OK, name="Send First Inspection Report")
def send_inspection_report(
    inward_id: int,
    email: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    db_inward = inward_service.get_inward_by_id(inward_id)
    print(f"[EMAIL SERVICE] Report for SRF {db_inward.srf_no} sent to {email} by User {current_user.user_id}")
    return {"message": f"Report for SRF {db_inward.srf_no} successfully queued for {email}."}