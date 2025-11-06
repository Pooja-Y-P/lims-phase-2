import json
from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import ValidationError, parse_obj_as
import logging
from fastapi import (
    APIRouter, Depends, status, HTTPException, Request,
    Body, Form, UploadFile, BackgroundTasks
)
from sqlalchemy.orm import Session

# Local imports
from backend.db import get_db
from backend.services.inward_services import InwardService
# === ADD THESE SERVICE IMPORTS ===
from backend.services.delayed_email_services import DelayedEmailService
from backend.services.notification_services import NotificationService
# ===============================

from backend.schemas import inward_schemas
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as UserSchema

# === ADD THESE SCHEMA IMPORTS (after you create them) ===
# You will need to define these in your inward_schemas.py file.
# I've included placeholder schemas below for now.
from backend.schemas.inward_schemas import (
    ReviewedFirResponse, DraftResponse, DraftUpdateRequest,
    InwardResponse, InwardUpdate, InwardCreate, EquipmentCreate,
    SendReportRequest
)
# For now, let's define placeholder schemas here to avoid import errors
# In a real scenario, these should be in your inward_schemas.py file
from pydantic import BaseModel
class PendingEmailTask(BaseModel): pass
class FailedNotificationsResponse(BaseModel): pass
# =========================================================


# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# --- FIR WORKFLOW ENDPOINTS ---

@router.post("/{inward_id}/complete-first-inspection", status_code=status.HTTP_200_OK)
async def complete_first_inspection(
    inward_id: int,
    equipment_updates: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    # This might need a more specific schema than InwardUpdate
    parsed_data = inward_schemas.InwardUpdate.model_validate({"equipment_list": equipment_updates})
    return await inward_service.update_inward_with_files(
        inward_id=inward_id,
        inward_data=parsed_data,
        files_by_index={},
        updater_id=current_user.user_id
    )

@router.post("/{inward_id}/send-fir", status_code=status.HTTP_200_OK)
async def send_fir_to_customer(
    inward_id: int,
    request_data: SendReportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Send FIR notification to customer"""
    if not request_data.send_later and not request_data.email:
        raise HTTPException(status_code=422, detail="Email is required for immediate sending.")
    
    inward_service = InwardService(db)
    return await inward_service.process_customer_notification(
        inward_id=inward_id,
        customer_email=request_data.email,
        background_tasks=background_tasks,
        send_later=request_data.send_later,
        creator_id=current_user.user_id
    )

@router.get("/reviewed-firs", response_model=List[ReviewedFirResponse])
async def get_reviewed_firs(
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Get FIRs that have been reviewed by customers (status = 'customer_reviewed')"""
    inward_service = InwardService(db)
    return await inward_service.get_inwards_by_status('customer_reviewed')

# === THIS IS THE NEW ENDPOINT THAT FIXES THE 405 ERROR ===
@router.put("/{inward_id}", response_model=InwardResponse)
async def update_inward(
    inward_id: int,
    request: Request,
    date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    srf_no: str = Form(...), # srf_no is part of the form data
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """
    General purpose endpoint to update an existing inward record.
    This handles PUT requests to /api/staff/inwards/{inward_id}.
    """
    try:
        equipment_list_data = json.loads(equipment_list)
        validated_equipment_list = parse_obj_as(List[inward_schemas.EquipmentCreate], equipment_list_data)
        
        inward_update_data = InwardUpdate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=validated_equipment_list
        )
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Validation Error: {e}")

    # File handling logic (if you update files this way)
    form_data = await request.form()
    photos_by_index: dict[int, list[UploadFile]] = {}
    for key, value in form_data.items():
        if key.startswith("photos_") and isinstance(value, UploadFile) and value.filename:
            try:
                index = int(key.split("_")[1])
                photos_by_index.setdefault(index, []).append(value)
            except (ValueError, IndexError): continue

    inward_service = InwardService(db)
    
    # Use the existing service method to perform the update
    db_inward = await inward_service.update_inward_with_files(
        inward_id=inward_id,
        inward_data=inward_update_data,
        files_by_index=photos_by_index,
        updater_id=current_user.user_id
    )
    
    return db_inward
# ========================================================


@router.get("/{inward_id}/sorted-equipment", response_model=InwardResponse)
async def get_inward_with_sorted_equipment(
    inward_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    return await inward_service.get_inward_with_sorted_equipment(inward_id)

# --- DRAFT AND SUBMISSION ENDPOINTS ---

@router.get("/drafts", response_model=List[DraftResponse])
async def get_drafts(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_user_drafts(current_user.user_id)

@router.get("/drafts/{draft_id}", response_model=inward_schemas.DraftResponse)
async def get_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    # ...
    inward_service = InwardService(db)
    # The error is likely happening inside this service call
    draft = await inward_service.get_draft_by_id(draft_id, current_user.user_id)
    return draft

@router.patch("/draft", response_model=DraftResponse)
async def update_draft(request: DraftUpdateRequest, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.update_draft(
        user_id=current_user.user_id,
        inward_id=request.inward_id,
        draft_data=request.draft_data
    )

@router.post("/submit", response_model=InwardResponse, status_code=status.HTTP_201_CREATED)
async def submit_inward(request: Request, date: date = Form(...), customer_dc_date: str = Form(...), customer_details: str = Form(...), receiver: str = Form(...), equipment_list: str = Form(...), inward_id: Optional[int] = Form(None), db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    try:
        equipment_list_data = json.loads(equipment_list)
        validated_equipment_list = parse_obj_as(List[EquipmentCreate], equipment_list_data)
        
        inward_data = InwardCreate(
            date=date, customer_dc_date=customer_dc_date,
            customer_details=customer_details, receiver=receiver, equipment_list=validated_equipment_list
        )
    except (ValidationError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=422, detail=f"Validation Error: {e}")

    form_data = await request.form()
    photos_by_index: dict[int, list[UploadFile]] = {}
    for key, value in form_data.items():
        if key.startswith("photos_") and isinstance(value, UploadFile) and value.filename:
            try:
                index = int(key.split("_")[1])
                photos_by_index.setdefault(index, []).append(value)
            except (ValueError, IndexError): continue

    inward_service = InwardService(db)
    db_inward = await inward_service.submit_inward(
        inward_data=inward_data, files_by_index=photos_by_index,
        user_id=current_user.user_id, draft_inward_id=inward_id
    )
    return db_inward

@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    if not await inward_service.delete_draft(draft_id, current_user.user_id):
        raise HTTPException(status_code=404, detail="Draft not found or access denied")

# ### ADDED SECTION: NOTIFICATION AND TASK MANAGEMENT ###
# These are the endpoints that were missing, causing the 404 errors.

@router.get("/delayed-emails/pending", response_model=List[PendingEmailTask])
async def get_pending_delayed_emails(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    """Get a list of emails that are scheduled to be sent later."""
    delayed_email_service = DelayedEmailService(db)
    pending_tasks = await delayed_email_service.get_pending_tasks_for_user(creator_id=current_user.user_id)
    return pending_tasks

# The corrected version for your router file
@router.get("/notifications/failed", response_model=FailedNotificationsResponse)
async def get_failed_notifications(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """Get a list of email notifications that failed to send."""
    notification_service = NotificationService(db)
    
    # === FIX: Use 'created_by' and the username string ===
    failed_notifications = await notification_service.get_failed_notifications(
        created_by=current_user.username, limit=limit
    )
    
    # === FIX: Use 'created_by' and the username string ===
    stats = await notification_service.get_notification_stats(
        created_by=current_user.username
    )
    
    return {"failed_notifications": failed_notifications, "stats": stats}
# ### END OF ADDED SECTION ###


# --- GENERAL INWARD ENDPOINTS ---

@router.get("/next-srf-no", response_model=dict)
def get_next_srf_no(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    from backend.services.srf_services import SrfService
    srf_service = SrfService(db)
    try:
        return {"srf_no": srf_service.generate_next_srf_no()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[InwardResponse])
async def get_all_inward_records(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_all_inwards()

@router.get("/{inward_id}", response_model=InwardResponse)
async def get_inward_by_id(inward_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    db_inward = await inward_service.get_inward_by_id(inward_id)
    if not db_inward:
        raise HTTPException(status_code=404, detail="Inward not found")
    return db_inward