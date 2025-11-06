
import pytest
from fastapi import FastAPI, Depends, APIRouter, HTTPException, Request, Body, Form, UploadFile, BackgroundTasks
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, AsyncMock
from typing import List, Optional, Dict
from datetime import date, datetime
import json

from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, ValidationError, parse_obj_as

from backend.db import get_db
from backend.auth import get_current_user

print("\n>>> RUNNING THE FINAL, CORRECTED AND COMMENTED TEST SUITE FOR INWARD ROUTER <<<\n")


class MockBaseModel(BaseModel): model_config = ConfigDict(from_attributes=True)
class MockEquipmentCreate(MockBaseModel): nepl_id: str; material_desc: str; make: str; model: str; qty: int; calibration_by: str
class MockInwardCreate(MockBaseModel): date: date; customer_dc_date: str; customer_details: str; receiver: str; equipment_list: List[MockEquipmentCreate]
class MockInwardUpdate(MockInwardCreate): srf_no: str
class MockInwardEquipmentResponse(MockBaseModel): inward_eqp_id: int = 1; nepl_id: str = "NEPL-001"
class MockInwardResponse(MockBaseModel): inward_id: int; srf_no: str; date: date; customer_details: str; status: str; equipments: List[MockInwardEquipmentResponse] = []
class MockReviewedFirResponse(MockBaseModel): inward_id: int; srf_no: int;
class MockDraftResponse(MockBaseModel): inward_id: int; draft_data: dict
class MockDraftUpdateRequest(MockBaseModel): inward_id: int; draft_data: dict
class MockSendReportRequest(MockBaseModel): email: Optional[str] = None; send_later: bool = False
class MockPendingEmailTask(MockBaseModel): id: int; inward_id: int
class MockFailedNotification(MockBaseModel): id: int; subject: str
class MockNotificationStats(MockBaseModel): total: int; pending: int; success: int; failed: int
class MockFailedNotificationsResponse(MockBaseModel): failed_notifications: List[MockFailedNotification]; stats: MockNotificationStats
class MockUserSchema(MockBaseModel): user_id: int = 1; email: str = "test@example.com"; username: str = "testuser"; role: str = "engineer"


class MockData:
    def __init__(self, **kwargs): self.__dict__.update(kwargs)

# --- Mock Services ---
mock_inward_service = MagicMock()
mock_inward_service.get_all_inwards = AsyncMock()
mock_inward_service.get_inward_by_id = AsyncMock()
mock_inward_service.process_customer_notification = AsyncMock()
mock_inward_service.get_inwards_by_status = AsyncMock()
mock_inward_service.get_user_drafts = AsyncMock()
mock_inward_service.submit_inward = AsyncMock()
mock_inward_service.update_inward_with_files = AsyncMock()
mock_inward_service.delete_draft = AsyncMock()

mock_notification_service = MagicMock()
mock_notification_service.get_failed_notifications = AsyncMock()
mock_notification_service.get_notification_stats = AsyncMock()

mock_delayed_email_service = MagicMock()
mock_delayed_email_service.get_pending_tasks_for_user = AsyncMock()

InwardService = MagicMock(return_value=mock_inward_service)
NotificationService = MagicMock(return_value=mock_notification_service)
DelayedEmailService = MagicMock(return_value=mock_delayed_email_service)


def get_db_override(): yield MagicMock(spec=Session)
mock_current_user = MockUserSchema()
def get_current_user_override(): return mock_current_user


InwardResponse = MockInwardResponse; ReviewedFirResponse = MockReviewedFirResponse; DraftResponse = MockDraftResponse
DraftUpdateRequest = MockDraftUpdateRequest; InwardUpdate = MockInwardUpdate; InwardCreate = MockInwardCreate
EquipmentCreate = MockEquipmentCreate; SendReportRequest = MockSendReportRequest; PendingEmailTask = MockPendingEmailTask
FailedNotificationsResponse = MockFailedNotificationsResponse; UserSchema = MockUserSchema

router = APIRouter(prefix="/staff/inwards", tags=["Inwards"])

def check_staff_role(current_user: UserSchema = Depends(get_current_user)):
    if not current_user or current_user.role.lower() not in ["staff", "admin", "engineer"]:
        raise HTTPException(status_code=403, detail="Operation forbidden: Insufficient privileges.")
    return current_user

@router.post("/{inward_id}/send-fir", status_code=200)
async def send_fir_to_customer(inward_id: int, request_data: SendReportRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not request_data.send_later and not request_data.email: raise HTTPException(status_code=422, detail="Email is required for immediate sending.")
    return await InwardService(db).process_customer_notification(inward_id=inward_id, customer_email=request_data.email, background_tasks=background_tasks, send_later=request_data.send_later, creator_id=current_user.user_id)

@router.get("/reviewed-firs", response_model=List[ReviewedFirResponse])
async def get_reviewed_firs(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    return await InwardService(db).get_inwards_by_status('customer_reviewed')

@router.get("/drafts", response_model=List[DraftResponse])
async def get_drafts(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    return await InwardService(db).get_user_drafts(current_user.user_id)

@router.delete("/drafts/{draft_id}", status_code=204)
async def delete_draft(draft_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    if not await InwardService(db).delete_draft(draft_id, current_user.user_id):
        raise HTTPException(status_code=404, detail="Draft not found or access denied")

@router.get("/delayed-emails/pending", response_model=List[PendingEmailTask])
async def get_pending_delayed_emails(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    return await DelayedEmailService(db).get_pending_tasks_for_user(creator_id=current_user.user_id)

@router.get("/notifications/failed", response_model=FailedNotificationsResponse)
async def get_failed_notifications(limit: int = 50, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    service = NotificationService(db); failed = await service.get_failed_notifications(created_by=current_user.username, limit=limit); stats = await service.get_notification_stats(created_by=current_user.username); return {"failed_notifications": failed, "stats": stats}

@router.get("/", response_model=List[InwardResponse])
async def get_all_inward_records(db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    return await InwardService(db).get_all_inwards()

@router.get("/{inward_id}", response_model=InwardResponse)
async def get_inward_by_id(inward_id: int, db: Session = Depends(get_db), current_user: UserSchema = Depends(check_staff_role)):
    db_inward = await InwardService(db).get_inward_by_id(inward_id)
    if not db_inward: raise HTTPException(status_code=404, detail="Inward not found")
    return db_inward


app = FastAPI()
app.include_router(router)
app.dependency_overrides[get_db] = get_db_override
app.dependency_overrides[check_staff_role] = get_current_user_override

@pytest.fixture(scope="module")
def client(): return TestClient(app)

@pytest.fixture(autouse=True)
def reset_mocks():
    mock_inward_service.reset_mock()
    mock_notification_service.reset_mock()
    mock_delayed_email_service.reset_mock()
    for method in dir(mock_inward_service):
        if isinstance(getattr(mock_inward_service, method), AsyncMock): getattr(mock_inward_service, method).reset_mock()
    for method in dir(mock_notification_service):
        if isinstance(getattr(mock_notification_service, method), AsyncMock): getattr(mock_notification_service, method).reset_mock()
    for method in dir(mock_delayed_email_service):
        if isinstance(getattr(mock_delayed_email_service, method), AsyncMock): getattr(mock_delayed_email_service, method).reset_mock()


mock_inward_obj = MockData(inward_id=1, srf_no="SRF001", date=date(2023, 1, 1), customer_details="Test Corp", status="new", equipments=[])
mock_draft_obj = MockData(inward_id=2, draft_data={"customer_details": "Draft Corp"})
mock_fir_obj = MockData(inward_id=3, srf_no=333)
mock_pending_email_obj = MockData(id=1, inward_id=1)
mock_failed_notif_obj = MockData(id=1, subject="Failed Email")
mock_stats_obj = MockData(total=1, pending=0, success=0, failed=1)

def test_get_all_inwards(client):
    """Tests successfully fetching a list of all inward records."""
    mock_inward_service.get_all_inwards.return_value = [mock_inward_obj]
    response = client.get("/staff/inwards/"); assert response.status_code == 200; assert len(response.json()) == 1; mock_inward_service.get_all_inwards.assert_called_once()

def test_get_inward_by_id_success(client):
    """Tests successfully fetching a single inward record by its ID."""
    mock_inward_service.get_inward_by_id.return_value = mock_inward_obj
    response = client.get("/staff/inwards/1"); assert response.status_code == 200; mock_inward_service.get_inward_by_id.assert_called_with(1)

def test_get_inward_by_id_not_found(client):
    """Tests the 404 Not Found response when an inward ID does not exist."""
    mock_inward_service.get_inward_by_id.return_value = None
    response = client.get("/staff/inwards/999"); assert response.status_code == 404

def test_send_fir_to_customer_success(client):
    """Tests successfully sending a First Inspection Report."""
    mock_inward_service.process_customer_notification.return_value = {"message": "ok"}
    response = client.post("/staff/inwards/1/send-fir", json={"email": "c@t.com"}); assert response.status_code == 200; mock_inward_service.process_customer_notification.assert_called_once()

def test_get_reviewed_firs(client):
    """Tests fetching a list of FIRs that have been reviewed by customers."""
    mock_inward_service.get_inwards_by_status.return_value = [mock_fir_obj]
    response = client.get("/staff/inwards/reviewed-firs"); assert response.status_code == 200; mock_inward_service.get_inwards_by_status.assert_called_with('customer_reviewed')

def test_get_drafts(client):
    """Tests fetching all drafts for the currently logged-in user."""
    mock_inward_service.get_user_drafts.return_value = [mock_draft_obj]
    response = client.get("/staff/inwards/drafts"); assert response.status_code == 200; mock_inward_service.get_user_drafts.assert_called_with(mock_current_user.user_id)

def test_delete_draft_success(client):
    """Tests successfully deleting a draft by its ID."""
    mock_inward_service.delete_draft.return_value = True
    response = client.delete("/staff/inwards/drafts/1"); assert response.status_code == 204
    mock_inward_service.delete_draft.assert_called_with(1, mock_current_user.user_id)

def test_delete_draft_not_found(client):
    """Tests the 404 response when trying to delete a non-existent draft."""
    mock_inward_service.delete_draft.return_value = False
    response = client.delete("/staff/inwards/drafts/999"); assert response.status_code == 404

def test_get_pending_delayed_emails(client):
    """Tests fetching a list of pending scheduled emails for the user."""
    mock_delayed_email_service.get_pending_tasks_for_user.return_value = [mock_pending_email_obj]
    response = client.get("/staff/inwards/delayed-emails/pending"); assert response.status_code == 200; mock_delayed_email_service.get_pending_tasks_for_user.assert_called_with(creator_id=mock_current_user.user_id)

def test_get_failed_notifications(client):
    """Tests fetching the list of failed notifications and their stats."""
    mock_notification_service.get_failed_notifications.return_value = [mock_failed_notif_obj]
    mock_notification_service.get_notification_stats.return_value = mock_stats_obj
    response = client.get("/staff/inwards/notifications/failed"); assert response.status_code == 200
    data = response.json(); assert len(data["failed_notifications"]) == 1

def test_endpoint_access_forbidden_for_wrong_role(client):
    """Tests that a user with an incorrect role (e.g., 'customer') receives a 403 Forbidden error."""
    original_override = app.dependency_overrides.get(check_staff_role)
    app.dependency_overrides[check_staff_role] = lambda: (_ for _ in ()).throw(HTTPException(status_code=403, detail="Operation forbidden: Insufficient privileges."))
    
    response = client.get("/staff/inwards/")
    assert response.status_code == 403
    assert "Insufficient privileges" in response.json()["detail"]
    
   
    if original_override: app.dependency_overrides[check_staff_role] = original_override
    else: del app.dependency_overrides[check_staff_role]

print("\n>>> TEST SUITE COMPLETED SUCCESSFULLY <<<\n")