# backend/schemas/inward_schemas.py
from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Json

# --- Inward Equipment Schemas ---
class InwardEquipmentCreate(BaseModel):
    """Schema for equipment data within the JSON string from the frontend."""
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


class InwardEquipmentResponse(BaseModel):
    """Schema for returning equipment data to the frontend."""
    inward_eqp_id: int
    nepl_id: str
    material_description: str 
    make: str
    model: str
    range: Optional[str]
    serial_no: Optional[str]
    quantity: int
    visual_inspection_notes: Optional[str]
    photos: Optional[List[str]] = []

    model_config = ConfigDict(from_attributes=True)

# --- Inward Main Schemas ---
class InwardCreate(BaseModel):
    srf_no: int
    date: date
    customer_dc_date: str
    customer_details: str
    receiver: str
    equipment_list: Json[List[InwardEquipmentCreate]]



class InwardResponse(BaseModel):
    """Schema for the main Inward record response to the frontend."""
    inward_id: int
    srf_no: int
    date: date
    customer_details: str
    status: str
    created_by: int
    received_by: int
    customer_name: Optional[str] = None
    receiver_name: Optional[str] = None
    equipments: List[InwardEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
