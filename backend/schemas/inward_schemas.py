import json
import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, field_validator, EmailStr, Field

# To avoid complex dependencies, using a simple placeholder for CustomerSchema
class CustomerSchema(BaseModel):
    customer_id: int
    customer_details: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    bill_to_address: Optional[str] = None
    ship_to_address: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# === This schema is for the nested 'customer' object in responses ===
class CustomerInfo(BaseModel):
    customer_details: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# === Equipment Schemas ===
# Defined before Inward/Response schemas to avoid forward reference issues where possible
class EquipmentCreate(BaseModel):
    inward_eqp_id: Optional[int] = None  # <--- CRITICAL: Needed to map to existing DB row
    status: Optional[str] = None         # <--- CRITICAL: Needed to preserve 'updated' status
    nepl_id: str
    material_desc: str
    make: str
    model: str
    range: Optional[str] = None
    unit: Optional[str] = None
    serial_no: Optional[str] = None
    qty: int
    visual_inspection_notes: Optional[str] = "OK"
    calibration_by: str
    supplier: Optional[str] = None
    out_dc: Optional[str] = None
    in_dc: Optional[str] = None
    nextage_ref: Optional[str] = None
    accessories_included: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    engineer_remarks: Optional[str] = None
    existing_photo_urls: Optional[List[str]] = None

class InwardEquipmentResponse(BaseModel):
    inward_eqp_id: int
    nepl_id: str
    material_description: str
    make: str
    model: str
    range: Optional[str] = None
    unit: Optional[str] = None
    serial_no: Optional[str] = None
    quantity: int
    visual_inspection_notes: Optional[str] = None
    photos: Optional[List[str]] = []
    calibration_by: Optional[str] = None
    supplier: Optional[str] = None
    out_dc: Optional[str] = None
    in_dc: Optional[str] = None
    nextage_contract_reference: Optional[str] = None
    accessories_included: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    engineer_remarks: Optional[str] = Field(None, alias='engineer_remarks')
    customer_remarks: Optional[str] = None 
    
    # --- STATUS FIELD FOR FILTERING ---
    status: Optional[str] = None 

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# === Response Schemas for various listings ===

class ReviewedFirResponse(BaseModel):
    inward_id: int
    srf_no: str
    updated_at: Optional[datetime.datetime] = None
    customer: Optional[CustomerInfo] = None
    
    # Overall Inward Status
    status: str 
    
    # List of Equipments (which now includes their individual status)
    equipments: List[InwardEquipmentResponse] = [] 

    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_reviewed(cls, v):
        return str(v) if v is not None else v

    model_config = ConfigDict(from_attributes=True)

class UpdatedInwardSummary(BaseModel):
    inward_id: int
    srf_no: str
    customer_details: Optional[str] = None
    status: str
    received_by: Optional[str] = None
    updated_at: Optional[datetime.datetime] = None
    equipment_count: int = 0
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    customer_remarks: Optional[str] = None
    engineer_remarks: Optional[str] = None 

    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_updated(cls, value):
        return str(value) if value is not None else value

    model_config = ConfigDict(from_attributes=True)

# === Customer Portal Schemas ===
class CustomerRemarkEntry(BaseModel):
    inward_eqp_id: int
    customer_remark: str

class CustomerRemarkRequest(BaseModel):
    remarks: List[CustomerRemarkEntry]

class InwardStatusUpdate(BaseModel):
    status: str

# === Draft Schemas ===
class DraftUpdateRequest(BaseModel):
    inward_id: Optional[int] = None
    draft_data: Dict[str, Any]

    @field_validator('draft_data', mode='before')
    @classmethod
    def ensure_dict(cls, value: Any) -> Dict[str, Any]:
        if isinstance(value, str):
            try: return json.loads(value)
            except json.JSONDecodeError as exc: raise ValueError("draft_data must be valid JSON") from exc
        if isinstance(value, dict): return value
        raise ValueError("draft_data must be an object")

class DraftResponse(BaseModel):
    inward_id: int
    draft_updated_at: Optional[datetime.datetime] = None
    customer_details: Optional[str] = None
    draft_data: Dict[str, Any]

    @field_validator('draft_data', mode='before')
    @classmethod
    def ensure_response_dict(cls, value: Any) -> Dict[str, Any]:
        if isinstance(value, str):
            try: return json.loads(value)
            except json.JSONDecodeError as exc: raise ValueError("draft_data must be valid JSON") from exc
        if isinstance(value, dict): return value
        raise ValueError("draft_data must be an object")

    model_config = ConfigDict(from_attributes=True)

# === Core Inward Schemas ===
class InwardCreate(BaseModel):
    srf_no: Optional[str] = None
    
    material_inward_date: datetime.date = Field(default_factory=datetime.date.today)
    customer_dc_date: Optional[str] = "" 
    
    customer_dc_no: str
    customer_id: int
    customer_details: str
    receiver: str
    equipment_list: List[EquipmentCreate]

    @field_validator('material_inward_date', mode='before')
    @classmethod
    def parse_material_inward_date(cls, v):
        if v == "" or v is None or v == datetime.date:
            return datetime.date.today()
        return v

    @field_validator('equipment_list', mode='before')
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try: return json.loads(v)
            except json.JSONDecodeError: raise ValueError("equipment_list contains invalid JSON")
        return v

class InwardUpdate(InwardCreate):
    srf_no: str

class InwardResponse(BaseModel):
    inward_id: int
    srf_no: str
    material_inward_date: datetime.date = Field(alias='material_inward_date')
    customer_dc_no: Optional[str] = None
    customer_dc_date: Optional[str] = None
    customer_id: Optional[int] = None
    customer_details: Optional[str] = None
    status: str
    customer: Optional[CustomerSchema] = None
    equipments: List[InwardEquipmentResponse] = []
    inward_srf_flag : bool = False

    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string(cls, v):
        return str(v) if v is not None else v

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# === Notification and Task Schemas ===
class SendReportRequest(BaseModel):
    emails: Optional[List[EmailStr]] = None
    send_later: bool = False

class RetryNotificationRequest(BaseModel):
    email: EmailStr

class PendingEmailTask(BaseModel):
    task_id: int = Field(alias='id')
    inward_id: int
    srf_no: str
    customer_details: Optional[str] = None
    recipient_email: Optional[EmailStr] = None
    scheduled_at: datetime.datetime
    created_at: datetime.datetime
    time_left_seconds: int
    is_overdue: bool

    @field_validator('srf_no', 'customer_details', mode='before')
    @classmethod
    def to_string(cls, v):
        return str(v) if v is not None else v
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class FailedNotificationItem(BaseModel):
    id: int
    recipient_email: Optional[str] = None
    subject: str
    error: Optional[str] = None
    created_at: datetime.datetime
    created_by: str
    srf_no: Optional[str] = None
    customer_details: Optional[str] = None

    @field_validator('srf_no', mode='before')
    @classmethod
    def srf_to_string_failed(cls, v): return str(v) if v is not None else v

    @field_validator('recipient_email', mode='before')
    @classmethod
    def empty_str_to_none(cls, v): return None if v == "" else v

    model_config = ConfigDict(from_attributes=True)

class NotificationStats(BaseModel):
    total: int
    pending: int
    success: int
    failed: int

class FailedNotificationsResponse(BaseModel):
    failed_notifications: List[FailedNotificationItem]
    stats: NotificationStats

class BatchExportRequest(BaseModel):
    inward_ids: List[int]