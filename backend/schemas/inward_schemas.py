import json
from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator

# --- Inward Equipment Schemas ---
class InwardEquipmentCreate(BaseModel):
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

# --- Inward Main Schemas ---
class InwardCreate(BaseModel):
    """This schema is for creating an inward. It should expect a string from the form."""
    srf_no: str
    date: date
    customer_dc_date: str
    customer_details: str
    receiver: str
    equipment_list: List[InwardEquipmentCreate]

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
    equipment_list: List[InwardEquipmentCreate]

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
    """Schema for the main Inward record response to the client."""
    inward_id: int
    # The database stores srf_no as an integer, so the response model
    # must expect an integer to avoid a validation error.
    srf_no: int
    date: date
    customer_details: str
    status: str
    equipments: List[InwardEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)