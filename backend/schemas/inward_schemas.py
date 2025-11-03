import json
from datetime import date
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, field_validator, EmailStr

# --- Inward Equipment Schemas ---

class EquipmentCreate(BaseModel):
    nepl_id: str
    material_desc: str
    make: str
    model: str
    range: Optional[str] = None
    serial_no: Optional[str] = None
    qty: int
    inspe_notes: Optional[str] = None
    calibration_by: str
    supplier: Optional[str] = None
    out_dc: Optional[str] = None
    in_dc: Optional[str] = None
    nextage_ref: Optional[str] = None
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    remarks: Optional[str] = None

class InwardEquipmentResponse(BaseModel):
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
    remarks: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Draft Schemas ---

class DraftData(BaseModel):
    """Schema for draft data stored in JSONB field"""
    srf_no: Optional[str] = None
    date: Optional[str] = None  # stored as ISO string
    customer_dc_date: Optional[str] = None
    customer_details: Optional[str] = None
    receiver: Optional[str] = None
    equipment_list: Optional[List[EquipmentCreate]] = []

class DraftUpdateRequest(BaseModel):
    """Schema for PATCH /staff/inwards/draft"""
    inward_id: Optional[int] = None  # If provided, updates existing draft
    draft_data: Dict[str, Any]  # Partial data to merge

class DraftResponse(BaseModel):
    """Response schema for draft operations"""
    inward_id: int
    draft_updated_at: str
    customer_details: Optional[str] = None
    draft_data: Dict[str, Any]

# --- Inward Main Schemas ---

class InwardCreate(BaseModel):
    """Schema for creating/submitting an inward"""
    srf_no: int
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

class InwardSubmitRequest(BaseModel):
    """Schema for POST /staff/inwards/submit"""
    inward_id: Optional[int] = None  # If provided, finalizes existing draft
    # Form data will be in multipart/form-data format
    
class InwardUpdate(BaseModel):
    """Schema for updating an existing inward"""
    srf_no: int
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
    """Schema for the main Inward record response to the client"""
    inward_id: int
    srf_no: int
    date: date
    customer_details: str
    status: str
    equipments: List[InwardEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)

# --- Email and Notification Schemas ---

class SendReportRequest(BaseModel):
    """Schema for POST /{inward_id}/send-report"""
    email: Optional[EmailStr] = None
    send_later: bool = False

class RetryNotificationRequest(BaseModel):
    """Schema for POST /notifications/{notification_id}/retry"""
    email: EmailStr