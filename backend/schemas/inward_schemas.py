import json
from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, field_validator, EmailStr, Field

# ... (other schemas are correct and can be collapsed) ...

# === FIX 1: This schema is for the nested 'customer' object ===
class CustomerInfo(BaseModel):
    customer_details: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# === FIX 2: This schema now correctly expects the nested 'customer' object ===
class ReviewedFirResponse(BaseModel):
    inward_id: int
    srf_no: str
    updated_at: Optional[datetime] = None
    customer: Optional[CustomerInfo] = None # It expects the nested object

    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_reviewed(cls, v):
        return str(v) if v is not None else v

    model_config = ConfigDict(from_attributes=True)

# ... (rest of the file is correct and can be collapsed) ...
# ... (Make sure to paste the full content of your file, this is just the changed part) ...
class EquipmentCreate(BaseModel):
    nepl_id: str; material_desc: str; make: str; model: str; range: Optional[str] = None; serial_no: Optional[str] = None; qty: int; inspe_notes: Optional[str] = "OK"; calibration_by: str; supplier: Optional[str] = None; out_dc: Optional[str] = None; in_dc: Optional[str] = None; nextage_ref: Optional[str] = None; qr_code: Optional[str] = None; barcode: Optional[str] = None; remarks_and_decision: Optional[str] = None
class InwardEquipmentResponse(BaseModel):
    inward_eqp_id: int; nepl_id: str; material_description: str; make: str; model: str; range: Optional[str] = None; serial_no: Optional[str] = None; quantity: int; visual_inspection_notes: Optional[str] = None; photos: Optional[List[str]] = []; remarks_and_decision: Optional[str] = None; model_config = ConfigDict(from_attributes=True)
class DraftUpdateRequest(BaseModel):
    inward_id: Optional[int] = None; draft_data: Dict[str, Any]
class DraftResponse(BaseModel):
    inward_id: int; draft_updated_at: str; customer_details: Optional[str] = None; draft_data: Dict[str, Any]; model_config = ConfigDict(from_attributes=True)
class InwardCreate(BaseModel):
    srf_no: Optional[str] = None; date: date; customer_dc_date: str; customer_details: str; receiver: str; equipment_list: List[EquipmentCreate]
    @field_validator('equipment_list', mode='before')
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try: return json.loads(v)
            except json.JSONDecodeError: raise ValueError("equipment_list contains invalid JSON")
        return v
class InwardUpdate(InwardCreate): pass
class InwardResponse(BaseModel):
    inward_id: int; srf_no: str; date: date; customer_details: str; status: str; equipments: List[InwardEquipmentResponse] = []
    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string(cls, v): return str(v) if v is not None else v
    model_config = ConfigDict(from_attributes=True)
class SendReportRequest(BaseModel):
    email: Optional[EmailStr] = None; send_later: bool = False
class RetryNotificationRequest(BaseModel):
    email: EmailStr
class PendingEmailTask(BaseModel):
    task_id: int = Field(alias='id'); inward_id: int; srf_no: str; customer_details: str; recipient_email: Optional[EmailStr] = None; scheduled_at: datetime; created_at: datetime; time_left_seconds: int; is_overdue: bool
    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_pending(cls, v): return str(v) if v is not None else v
    model_config = ConfigDict(from_attributes=True, populate_by_name=True, by_alias=True)
class FailedNotificationItem(BaseModel):
    id: int; recipient_email: Optional[str] = None; subject: str; error: Optional[str] = None; created_at: datetime; created_by: str; srf_no: Optional[str] = None; customer_details: Optional[str] = None
    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_failed(cls, v): return str(v) if v is not None else v
    @field_validator('recipient_email', mode='before')
    @classmethod
    def empty_str_to_none(cls, v): return None if v == "" else v
    model_config = ConfigDict(from_attributes=True)
class NotificationStats(BaseModel):
    total: int; pending: int; success: int; failed: int
class FailedNotificationsResponse(BaseModel):
    failed_notifications: List[FailedNotificationItem]; stats: NotificationStats