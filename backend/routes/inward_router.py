
# backend/routes/inward_router.py

from typing import List, Optional
from datetime import date
from fastapi import (
    APIRouter, Depends, status, HTTPException, Request,
    Body, Form, UploadFile, BackgroundTasks
)
from pydantic import BaseModel, EmailStr, ValidationError, parse_obj_as
import json
from sqlalchemy.orm import Session

# Local imports
from backend.db import get_db
from backend.services.inward_services import InwardService
from backend.services.delayed_email_services import DelayedEmailService
from backend.services.notification_services import NotificationService
from backend.services.srf_services import SrfService
from backend.schemas.inward_schemas import InwardCreate, InwardResponse, InwardUpdate, EquipmentCreate
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as UserSchema

ALLOWED_ROLES = ["staff", "admin", "engineer"]
router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    """Dependency to authorize that the user has a permitted staff role."""
    if not current_user or current_user.role.lower() not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation forbidden: Insufficient privileges."
        )
    return current_user

# --- Pydantic models for requests ---
class SendReportRequest(BaseModel):
    email: Optional[EmailStr] = None
    send_later: bool = False

class RetryNotificationRequest(BaseModel):
    email: Optional[EmailStr] = None

# --- NEW ENDPOINT ---
# GET /next-srf-no (Get next SRF number)
@router.get("/next-srf-no", response_model=dict)
def get_next_srf_no(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    """Get the next available SRF number for creating a new inward."""
    srf_service = SrfService(db)
    try:
        next_srf = srf_service.generate_next_srf_no()
        return {"srf_no": next_srf}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# --- SIMPLIFIED ENDPOINT ---
# POST / (Create Inward with Photos)
@router.post("/", response_model=InwardResponse, status_code=status.HTTP_201_CREATED)
async def create_inward_with_photos(
    request: Request,
    date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Receives multipart/form-data and lets Pydantic handle validation and parsing."""
    try:
        # Generate SRF number on the backend
        srf_service = SrfService(db)
        srf_no = srf_service.generate_next_srf_no()
        
        # Manually parse and validate equipment_list
        equipment_list_data = json.loads(equipment_list)
        validated_equipment_list = parse_obj_as(List[EquipmentCreate], equipment_list_data)

        inward_data = InwardCreate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=validated_equipment_list # Use the validated list
        )
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Validation Error in equipment list: {e}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    db_inward = await inward_service.create_inward_with_files(
        inward_data=inward_data,
        files_by_index=photos_by_index,
        creator_id=current_user.user_id
    )
    return db_inward

# ... (rest of the file remains the same) ...

# GET / (Get All Inward Records)
@router.get("/", response_model=List[InwardResponse])
def get_all_inward_records(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return inward_service.get_all_inwards()

# GET /{inward_id} (Get Inward by ID)
@router.get("/{inward_id}", response_model=InwardResponse)
def get_inward_by_id(inward_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    db_inward = inward_service.get_inward_by_id(inward_id)
    if not db_inward:
        raise HTTPException(status_code=404, detail="Inward not found")
    return db_inward

# PUT /{inward_id} (Update Inward)
@router.put("/{inward_id}", response_model=InwardResponse)
async def update_inward_with_photos(
    inward_id: int,
    request: Request,
    date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    try:
        inward_service = InwardService(db)
        existing_inward = inward_service.get_inward_by_id(inward_id)
        srf_no = existing_inward.srf_no
        
        equipment_list_data = json.loads(equipment_list)
        validated_equipment_list = parse_obj_as(List[EquipmentCreate], equipment_list_data)

        inward_data = InwardUpdate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=validated_equipment_list
        )
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Validation Error: {e}")

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
    db_inward = await inward_service.update_inward_with_files(
        inward_id=inward_id,
        inward_data=inward_data,
        files_by_index=photos_by_index,
        updater_id=current_user.user_id
    )
    return db_inward

# POST /{inward_id}/send-report
@router.post("/{inward_id}/send-report", status_code=status.HTTP_200_OK)
async def send_customer_feedback_request(
    inward_id: int, request_data: SendReportRequest, background_tasks: BackgroundTasks,
    db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)
):
    if not request_data.send_later and not request_data.email:
        raise HTTPException(status_code=422, detail="Email is required for immediate sending.")

    inward_service = InwardService(db)
    result = await inward_service.process_customer_notification(
        inward_id=inward_id, customer_email=request_data.email,
        send_later=request_data.send_later, creator_id=current_user.user_id,
        background_tasks=background_tasks
    )
    return result

# ... (rest of the file remains the same) ...
# GET /delayed-emails/pending (The endpoint for the manager)
@router.get("/delayed-emails/pending", response_model=dict)
def get_pending_delayed_emails(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not hasattr(current_user, 'user_id'):
        raise HTTPException(status_code=401, detail="Authentication failed.")

    delayed_email_service = DelayedEmailService(db)
    pending_tasks = delayed_email_service.get_pending_tasks_for_user(creator_id=current_user.user_id)
    return {"pending_tasks": pending_tasks}

# POST /delayed-emails/{task_id}/send (Send a scheduled email)
@router.post("/delayed-emails/{task_id}/send", status_code=status.HTTP_200_OK)
async def send_delayed_email_now(
    task_id: int,
    request_data: dict = Body(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    email = request_data.get("email")
    if not email:
        raise HTTPException(status_code=422, detail="Email is required.")

    inward_service = InwardService(db)
    success = await inward_service.send_scheduled_report_now(
        task_id=task_id,
        customer_email=email,
        background_tasks=background_tasks
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email.")

    return {"message": "Email sent successfully."}

# DELETE /delayed-emails/{task_id} (Cancel a scheduled email)
@router.delete("/delayed-emails/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_delayed_email(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    delayed_service = DelayedEmailService(db)
    success = delayed_service.cancel_task(task_id=task_id)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found or already processed.")
    return

# GET /notifications/failed (Get failed notifications)
@router.get("/notifications/failed", response_model=dict)
def get_failed_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    notification_service = NotificationService(db)
    failed_notifications = notification_service.get_failed_notifications(
        created_by=current_user.username,
        limit=limit
    )
    
    stats = notification_service.get_notification_stats(
        created_by=current_user.username
    )
    
    return {
        "failed_notifications": failed_notifications,
        "stats": stats
    }

# POST /notifications/{notification_id}/retry (Retry failed notification)
@router.post("/notifications/{notification_id}/retry", status_code=status.HTTP_200_OK)
async def retry_failed_notification(
    notification_id: int,
    request_data: RetryNotificationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    notification_service = NotificationService(db)
    
    success = await notification_service.retry_failed_notification(
        notification_id=notification_id,
        background_tasks=background_tasks,
        new_email=request_data.email
    )
    
    if success:
        return {"message": "Notification retry queued successfully."}
    else:
        raise HTTPException(status_code=500, detail="Failed to queue notification retry.")

# DELETE /notifications/{notification_id} (Delete notification)
@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    notification_service = NotificationService(db)
    success = notification_service.delete_notification(notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return