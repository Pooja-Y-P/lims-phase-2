import json
from datetime import date, datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, EmailStr, ValidationError, field_validator
import logging
from fastapi import (
    APIRouter, Depends, status, HTTPException, Request,
    Body, Form, UploadFile, BackgroundTasks
)
from fastapi.responses import StreamingResponse
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
    DraftUpdateRequest,
    DraftResponse,
    SendReportRequest,
    RetryNotificationRequest,
    ReviewedFirResponse,
    PendingEmailTask,
    UpdatedInwardSummary,
    FailedNotificationsResponse,
    BatchExportRequest
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
ALLOWED_ROLES = ["staff", "admin", "engineer"]
router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    if not current_user or current_user.role.lower() not in ALLOWED_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operation forbidden.")
    return current_user

# =========================================================
# 1. STATIC ROUTES (MUST BE DEFINED FIRST)
# =========================================================

@router.get("/next-no", response_model=dict)
def get_next_srf_no(db: Session = Depends(get_db)):
    """
    Generates the next available SRF Number (e.g., NEPL25001).
    Defined AT THE TOP to prevent '422 Unprocessable Entity' errors 
    caused by catching this string in dynamic int routes.
    """
    return {"next_srf_no": SrfService(db).generate_next_srf_no()}

@router.get("/drafts", response_model=List[DraftResponse])
async def get_drafts(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_user_drafts(current_user.user_id)

# =========================================================
# 2. DYNAMIC ROUTES WITH SPECIFIC PREFIXES
# =========================================================

@router.get("/drafts/{draft_id}", response_model=DraftResponse)
async def get_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_draft_by_id(draft_id, current_user.user_id)

@router.patch("/draft", response_model=DraftResponse)
async def update_draft(
    req: Request,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    content_type = req.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await req.form()
        inward_id_raw = form.get("inward_id")
        draft_data_raw = form.get("draft_data")
        if draft_data_raw is None:
            raise HTTPException(status_code=422, detail="draft_data is required.")

        try:
            draft_data = json.loads(draft_data_raw)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail="draft_data must be valid JSON.") from exc

        files_by_index: Dict[int, List[UploadFile]] = {}
        for key in form.keys():
            if not key.startswith("photos_"):
                continue
            try:
                index = int(key.split("_")[1])
            except (IndexError, ValueError):
                continue
            upload_files = [file for file in form.getlist(key) if getattr(file, "filename", None)]
            if upload_files:
                files_by_index.setdefault(index, []).extend(upload_files)

        if files_by_index:
            saved_paths = await inward_service.save_draft_files(files_by_index)
            equipment_list = draft_data.get("equipment_list")
            if not isinstance(equipment_list, list):
                equipment_list = []
            for index, paths in saved_paths.items():
                if index >= len(equipment_list) or not isinstance(equipment_list[index], dict):
                    continue
                existing_urls = equipment_list[index].get("existing_photo_urls") or equipment_list[index].get("existingPhotoUrls") or []
                if not isinstance(existing_urls, list):
                    existing_urls = []
                existing_urls = [url for url in existing_urls if isinstance(url, str)]
                equipment_list[index]["existing_photo_urls"] = existing_urls + paths
            draft_data["equipment_list"] = equipment_list

        inward_id = int(inward_id_raw) if inward_id_raw else None
        return await inward_service.update_draft(user_id=current_user.user_id, inward_id=inward_id, draft_data=draft_data)

    payload = await req.json()
    update_request = DraftUpdateRequest(**payload)
    return await inward_service.update_draft(user_id=current_user.user_id, inward_id=update_request.inward_id, draft_data=update_request.draft_data)

@router.post("/submit", response_model=InwardResponse, status_code=status.HTTP_201_CREATED)
async def submit_inward(
    req: Request,
    material_inward_date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_dc_no: str = Form(...),
    customer_id: int = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    srf_no: str = Form(...),
    inward_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    try:
        inward_data = InwardCreate(
            material_inward_date=material_inward_date,
            customer_dc_date=customer_dc_date,
            customer_dc_no=customer_dc_no,
            customer_id=customer_id,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=json.loads(equipment_list),
            srf_no=srf_no
        )
    except (ValidationError, ValueError, json.JSONDecodeError) as e:
        logger.error(f"Validation error on submit: {e}")
        raise HTTPException(status_code=422, detail=f"Validation Error: {e}")

    form_data = await req.form()
    photos_by_index: Dict[int, List[UploadFile]] = {}
    for key in form_data.keys():
        if not key.startswith("photos_"):
            continue
        try:
            index = int(key.split('_')[1])
        except (IndexError, ValueError):
            continue
        files = form_data.getlist(key)
        upload_files = [file for file in files if getattr(file, "filename", None)]
        if upload_files:
            photos_by_index[index] = upload_files
    inward_service = InwardService(db)

    return await inward_service.submit_inward(
        inward_data=inward_data,
        files_by_index=photos_by_index,
        user_id=current_user.user_id,
        draft_inward_id=inward_id,
        customer_details_value=customer_details
    )

@router.delete("/drafts/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not await InwardService(db).delete_draft(draft_id, current_user.user_id):
        raise HTTPException(status_code=404, detail="Draft not found")

# --- GENERAL LISTING ENDPOINTS ---

@router.get("/", response_model=List[InwardResponse])
async def get_all_inward_records(db: Session = Depends(get_db)):
    return await InwardService(db).get_all_inwards()

@router.get("/reviewed-firs", response_model=List[ReviewedFirResponse])
async def get_reviewed_firs(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    inward_service = InwardService(db)
    return await inward_service.get_all_inwards(status='reviewed')

@router.get("/exportable-list", response_model=List[UpdatedInwardSummary])
async def list_exportable_inwards(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    return await inward_service.get_inwards_for_export(start_date=start_date, end_date=end_date)

@router.get("/updated", response_model=List[UpdatedInwardSummary])
async def list_updated_inwards(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    return await inward_service.get_updated_inwards(start_date=start_date, end_date=end_date)

@router.post("/export-batch")
async def export_inwards_batch(
    request_data: BatchExportRequest,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    excel_stream = await inward_service.generate_multiple_inwards_export(request_data.inward_ids)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"inwards_export_{timestamp}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

# --- EMAIL AND NOTIFICATION ENDPOINTS ---

@router.post("/{inward_id}/send-report", status_code=status.HTTP_200_OK)
async def send_customer_feedback_request(inward_id: int, request_data: SendReportRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not request_data.send_later and not request_data.emails:
        raise HTTPException(status_code=422, detail="At least one email is required when sending immediately.")
    inward_service = InwardService(db)
    return await inward_service.process_customer_notification(inward_id=inward_id, customer_emails=request_data.emails, send_later=request_data.send_later, creator_id=current_user.user_id, background_tasks=background_tasks)

@router.get("/delayed-emails/pending", response_model=List[PendingEmailTask])
async def get_pending_delayed_emails(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    delayed_email_service = DelayedEmailService(db)
    return await delayed_email_service.get_all_pending_tasks()

@router.post("/delayed-emails/{task_id}/send", status_code=status.HTTP_200_OK)
async def send_delayed_email_now(task_id: int, request_data: dict = Body(...), background_tasks: BackgroundTasks = BackgroundTasks(), db: Session = Depends(get_db)):
    emails = request_data.get("emails", [])
    if not emails: 
        raise HTTPException(status_code=422, detail="At least one email is required.")
    if not await InwardService(db).send_scheduled_report_now(task_id=task_id, customer_emails=emails, background_tasks=background_tasks):
        raise HTTPException(status_code=500, detail="Failed to send email.")
    return {"message": "Email sent successfully."}

@router.delete("/delayed-emails/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_delayed_email(task_id: int, db: Session = Depends(get_db)):
    if not await DelayedEmailService(db).cancel_task(task_id=task_id):
        raise HTTPException(status_code=404, detail="Task not found.")

@router.get("/notifications/failed", response_model=FailedNotificationsResponse)
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

# =========================================================
# 3. CATCH-ALL DYNAMIC ROUTES (MUST BE DEFINED LAST)
# =========================================================

@router.get("/{inward_id}/export")
async def export_updated_inward(
    inward_id: int,
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    inward_service = InwardService(db)
    excel_stream = await inward_service.generate_inward_export(inward_id)
    filename = f"inward_{inward_id}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/{inward_id}", response_model=InwardResponse)
async def get_inward_by_id(inward_id: int, db: Session = Depends(get_db)):
    db_inward = await InwardService(db).get_inward_by_id(inward_id)
    if not db_inward:
        raise HTTPException(status_code=404, detail="Inward not found")
    return db_inward

@router.put("/{inward_id}", response_model=InwardResponse)
async def update_inward(
    inward_id: int,
    req: Request,
    material_inward_date: date = Form(...),
    customer_dc_date: str = Form(...),
    customer_dc_no: str = Form(...),
    customer_id: int = Form(...),
    customer_details: str = Form(...),
    receiver: str = Form(...),
    equipment_list: str = Form(...),
    srf_no: str = Form(...),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(check_staff_role)
):
    try:
        inward_data = InwardUpdate(
            srf_no=srf_no,
            material_inward_date=material_inward_date,
            customer_dc_date=customer_dc_date,
            customer_dc_no=customer_dc_no,
            customer_id=customer_id,
            customer_details=customer_details,
            receiver=receiver,
            equipment_list=json.loads(equipment_list)
        )
    except (ValidationError, ValueError, json.JSONDecodeError) as e:
        logger.error(f"Validation error on update: {e}")
        raise HTTPException(status_code=422, detail=f"Validation Error: {e}")

    form_data = await req.form()
    photos_by_index: Dict[int, List[UploadFile]] = {}
    for key in form_data.keys():
        if not key.startswith("photos_"):
            continue
        try:
            index = int(key.split('_')[1])
        except (IndexError, ValueError):
            continue
        files = form_data.getlist(key)
        upload_files = [file for file in files if getattr(file, "filename", None)]
        if upload_files:
            photos_by_index[index] = upload_files
    inward_service = InwardService(db)

    updated_inward = await inward_service.update_inward_with_files(
        inward_id=inward_id,
        inward_data=inward_data,
        files_by_index=photos_by_index,
        updater_id=current_user.user_id
    )
    return updated_inward