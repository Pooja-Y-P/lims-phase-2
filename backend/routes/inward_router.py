import json
from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, ValidationError, field_validator
import logging
from fastapi import (
    APIRouter, Depends, status, HTTPException, Request,
    Body, Form, UploadFile, BackgroundTasks
)
from sqlalchemy.orm import Session

# Local imports
from backend.db import get_db
from backend.services.inward_services import InwardService
from backend.services.delayed_email_services import DelayedEmailService
from backend.services.notification_services import NotificationService
from backend.services.srf_services import SrfService
from backend.auth import get_current_user
from backend.schemas.user_schemas import User as UserSchema

# --- IMPORTING from your central schema file ---
from backend.schemas.inward_schemas import (
    InwardCreate, 
    InwardResponse, 
    InwardUpdate, 
    EquipmentCreate,
    DraftUpdateRequest, 
    DraftResponse, 
    SendReportRequest, 
    RetryNotificationRequest,
    ReviewedFirResponse,
    PendingEmailTask
)

class CorrectedFailedNotificationItem(BaseModel):
    id: int
    recipient_email: Optional[str] = None
    subject: str
    error: Optional[str] = None
    created_at: datetime
    created_by: str
    srf_no: Optional[str] = None
    customer_details: Optional[str] = None
    
    @field_validator('srf_no', mode='before')
    @classmethod
    def validate_srf_no(cls, value): return str(value) if value is not None else value
    
    @field_validator('recipient_email', mode='before')
    @classmethod
    def empty_str_to_none(cls, v):
        if v == "": return None
        return v
    
    class Config: 
        from_attributes = True

class NotificationStats(BaseModel):
    total: int; pending: int; success: int; failed: int

class CorrectedFailedNotificationsResponse(BaseModel):
    failed_notifications: List[CorrectedFailedNotificationItem]
    stats: NotificationStats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
ALLOWED_ROLES = ["staff", "admin", "engineer"]
router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    if not current_user or current_user.role.lower() not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation forbidden.")
    return current_user

# --- DRAFT ENDPOINTS ---
@router.get("/drafts", response_model=List[DraftResponse])
async def get_drafts(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_user_drafts(current_user.user_id)

@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_draft_by_id(draft_id, current_user.user_id)

@router.patch("/draft", response_model=DraftResponse)
async def update_draft(request: DraftUpdateRequest, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.update_draft(user_id=current_user.user_id, inward_id=request.inward_id, draft_data=request.draft_data)

@router.post("/submit", response_model=InwardResponse, status_code=status.HTTP_201_CREATED)
async def submit_inward(req: Request, date: date = Form(...), customer_dc_date: str = Form(...), customer_details: str = Form(...), receiver: str = Form(...), equipment_list: str = Form(...), inward_id: Optional[int] = Form(None), db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    try:
        inward_data = InwardCreate(date=date, customer_dc_date=customer_dc_date, customer_details=customer_details, receiver=receiver, equipment_list=equipment_list)
        srf_service = SrfService(db)
        if not inward_id: # Only generate new SRF for new submissions, not finalizing drafts
             inward_data.srf_no = srf_service.generate_next_srf_no()
    except (ValidationError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    form_data = await req.form()
    photos_by_index = {int(k.split('_')[1]): v for k, v in form_data.items() if k.startswith('photos_') and isinstance(v, UploadFile) and v.filename}
    inward_service = InwardService(db)
    return await inward_service.submit_inward(inward_data=inward_data, files_by_index=photos_by_index, user_id=current_user.user_id, draft_inward_id=inward_id)

@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not await InwardService(db).delete_draft(draft_id, current_user.user_id):
        raise HTTPException(status_code=404, detail="Draft not found")

# --- GENERAL INWARD & FIR ENDPOINTS ---
@router.get("/next-srf-no", response_model=dict)
def get_next_srf_no(db: Session = Depends(get_db)):
    return {"srf_no": SrfService(db).generate_next_srf_no()}

@router.get("/", response_model=List[InwardResponse])
async def get_all_inward_records(db: Session = Depends(get_db)):
    return await InwardService(db).get_all_inwards()

@router.get("/{inward_id}", response_model=InwardResponse)
async def get_inward_by_id(inward_id: int, db: Session = Depends(get_db)):
    db_inward = await InwardService(db).get_inward_by_id(inward_id)
    if not db_inward:
        raise HTTPException(status_code=404, detail="Inward not found")
    return db_inward

# === THIS IS THE NEW ENDPOINT TO FIX THE 405 ERROR ===
@router.put("/{inward_id}", response_model=InwardResponse)
async def update_inward(
    inward_id: int,
    req: Request,
    date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    srf_no: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    """
    Endpoint to update an existing, finalized inward record.
    This handles PUT requests from the inward form when in edit mode.
    """
    try:
        inward_data = InwardUpdate(
            srf_no=srf_no,
            date=date,
            customer_dc_date=customer_dc_date,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=equipment_list
        )
    except (ValidationError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))

    form_data = await req.form()
    photos_by_index = {int(k.split('_')[1]): v for k, v in form_data.items() if k.startswith('photos_') and isinstance(v, UploadFile) and v.filename}
    inward_service = InwardService(db)
    
    updated_inward = await inward_service.update_inward_with_files(
        inward_id=inward_id,
        inward_data=inward_data,
        files_by_index=photos_by_index,
        updater_id=current_user.user_id
    )
    return updated_inward

@router.get("/reviewed-firs", response_model=List[ReviewedFirResponse])
async def get_reviewed_firs(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_inwards_by_status('customer_reviewed')

# --- EMAIL AND NOTIFICATION ENDPOINTS ---
@router.post("/{inward_id}/send-report", status_code=status.HTTP_200_OK)
async def send_customer_feedback_request(inward_id: int, request_data: SendReportRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not request_data.send_later and not request_data.email:
        raise HTTPException(status_code=422, detail="Email is required.")
    inward_service = InwardService(db)
    return await inward_service.process_customer_notification(inward_id=inward_id, customer_email=request_data.email, send_later=request_data.send_later, creator_id=current_user.user_id, background_tasks=background_tasks)

@router.get("/delayed-emails/pending", response_model=List[PendingEmailTask])
async def get_pending_delayed_emails(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    delayed_email_service = DelayedEmailService(db)
    return await delayed_email_service.get_all_pending_tasks()

@router.post("/delayed-emails/{task_id}/send", status_code=status.HTTP_200_OK)
async def send_delayed_email_now(task_id: int, request_data: dict = Body(...), background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
    email = request_data.get("email")
    if not email: raise HTTPException(status_code=422, detail="Email is required.")
    if not await InwardService(db).send_scheduled_report_now(task_id=task_id, customer_email=email, background_tasks=background_tasks):
        raise HTTPException(status_code=500, detail="Failed to send email.")
    return {"message": "Email sent successfully."}

@router.delete("/delayed-emails/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_delayed_email(task_id: int, db: Session = Depends(get_db)):
    if not await DelayedEmailService(db).cancel_task(task_id=task_id):
        raise HTTPException(status_code=404, detail="Task not found.")

@router.get("/notifications/failed", response_model=CorrectedFailedNotificationsResponse)
async def get_failed_notifications(limit: int = 50, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    notification_service = NotificationService(db)
    failed_notifications = await notification_service.get_failed_notifications(limit=limit)
    stats = await notification_service.get_notification_stats()
    return {"failed_notifications": failed_notifications, "stats": stats}

@router.post("/notifications/{notification_id}/retry", status_code=status.HTTP_200_OK)
async def retry_failed_notification(notification_id: int, request_data: RetryNotificationRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not await NotificationService(db).retry_failed_notification(notification_id=notification_id, background_tasks=background_tasks, new_email=request_data.email):
        raise HTTPException(status_code=500, detail="Failed to queue notification retry.")
    return {"message": "Notification retry queued successfully."}

@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(notification_id: int, db: Session = Depends(get_db)):
    if not await NotificationService(db).delete_notification(notification_id):
        raise HTTPException(status_code=404, detail="Notification not found.")