import json
from datetime import date, datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, field_validator, EmailStr

# ====================================================================
#  1. Schemas for Inward Equipment
# ====================================================================

class EquipmentCreate(BaseModel):
    """Schema for creating a single equipment item within an inward."""
    nepl_id: str
    material_desc: str
    make: str
    model: str
    range: Optional[str] = None
    serial_no: Optional[str] = None
    qty: int
    inspe_notes: Optional[str] = "OK"  # Default to "OK"
    calibration_by: str
    supplier: Optional[str] = None
    out_dc: Optional[str] = None
    in_dc: Optional[str] = None
    nextage_ref: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    remarks_and_decision: Optional[str] = None

class InwardEquipmentResponse(BaseModel):
    """Schema for responding with equipment details."""
    inward_eqp_id: int
    nepl_id: str
    material_description: str
    make: str
    model: str
    range: Optional[str] = None
    serial_no: Optional[str] = None
    quantity: int
    visual_inspection_notes: Optional[str] = None
    photos: Optional[List[str]] = []
    remarks_and_decision: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)


# ====================================================================
#  2. Schemas for Draft Management
# ====================================================================

class DraftUpdateRequest(BaseModel):
    """Schema for PATCH /staff/inwards/draft to save/update a draft."""
    inward_id: Optional[int] = None
    draft_data: Dict[str, Any]

class DraftResponse(BaseModel):
    """Response schema for draft operations (GET /drafts, PATCH /draft)."""
    inward_id: int
    draft_updated_at: str
    customer_details: Optional[str] = None
    draft_data: Dict[str, Any]


# ====================================================================
#  3. Schemas for Main Inward Form (Create, Update, Response)
# ====================================================================

class InwardCreate(BaseModel):
    """
    Schema for creating/submitting an inward. This is the main payload
    from the frontend form.
    """
    srf_no: Optional[str] = None # SRF No can be optional as it can be auto-generated
    date: date
    customer_dc_date: str
    customer_details: str
    receiver: str
    equipment_list: List[EquipmentCreate]

    @field_validator('equipment_list', mode='before')
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("equipment_list contains invalid JSON")
        return v

class InwardUpdate(BaseModel):
    """Schema for updating an existing inward."""
    srf_no: str
    date: date
    customer_dc_date: str
    customer_details: str
    receiver: str
    equipment_list: List[EquipmentCreate]

    @field_validator('equipment_list', mode='before')
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("equipment_list contains invalid JSON")
        return v

class InwardResponse(BaseModel):
    """Standard response schema for an Inward record, including its equipment."""
    inward_id: int
    srf_no: int
    date: date
    customer_details: str
    status: str
    equipments: List[InwardEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ====================================================================
#  4. Schemas for Specific Workflows (FIRs, Notifications)
# ====================================================================

class CustomerInfo(BaseModel):
    """A minimal schema to represent nested customer data for responses."""
    customer_details: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReviewedFirResponse(BaseModel):
    """Schema for the response of GET /staff/inwards/reviewed-firs."""
    inward_id: int
    srf_no: int
    updated_at: Optional[datetime] = None
    customer: Optional[CustomerInfo] = None

    model_config = ConfigDict(from_attributes=True)

class SendReportRequest(BaseModel):
    """Schema for POST /{inward_id}/send-fir endpoint."""
    email: Optional[EmailStr] = None
    send_later: bool = False

class RetryNotificationRequest(BaseModel):
    """Schema for POST /notifications/{notification_id}/retry endpoint."""
    email: EmailStr


# ====================================================================
#  5. ADDED SCHEMAS for Delayed/Failed Notifications
# ====================================================================

class PendingEmailTask(BaseModel):
    """Describes a single scheduled email for the frontend."""
    task_id: int
    inward_id: int
    srf_no: str # Or int, depending on the service response
    customer_details: str
    scheduled_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class FailedNotificationItem(BaseModel):
    """Describes a single failed email notification for the frontend."""
    notification_id: int
    inward_id: int
    srf_no: str # Or int
    recipient: str
    status: str
    error_message: Optional[str] = None
    last_attempted_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class FailedNotificationsResponse(BaseModel):
    """The complete response for the failed notifications endpoint."""
    failed_notifications: List[FailedNotificationItem]
    stats: Dict[str, int]