import json
from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, field_validator, ValidationError

# --- Inward Equipment Schemas ---

class InwardEquipmentCreate(BaseModel):
    """
    Schema for validating equipment data received from the frontend,
    typically within a JSON string inside a FormData object.
    """
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
    remarks: Optional[str] = None # Field for customer remarks

class InwardEquipmentResponse(BaseModel):
    """Schema for returning detailed equipment data to the client."""
    inward_eqp_id: int
    nepl_id: str
    # Use aliases to map model attribute names (e.g., material_description)
    # to desired JSON field names (e.g., material_desc) for consistency.
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
    """Schema for validating the main inward creation request data."""
    srf_no: int
    date: date
    customer_dc_date: str # Kept as string as per your original schema
    customer_details: str
    receiver: str
    # This field expects a list, but the validator will handle conversion from a string.
    equipment_list: List[InwardEquipmentCreate]

    # 🚀 BEST PRACTICE: Add a validator to automatically parse the JSON string
    # from the FormData into a list of Pydantic models.
    @field_validator('equipment_list', mode='before')
    @classmethod
    def parse_json_string(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError as e:
                raise ValueError(f"Invalid JSON in equipment_list: {e}")
        return v

class InwardResponse(BaseModel):
    """Schema for the main Inward record response to the client."""
    inward_id: int
    srf_no: int
    date: date
    customer_details: str
    status: str
    created_by: int
    received_by: int
    
    # Optional fields that will be populated in the router
    customer_name: Optional[str] = None
    receiver_name: Optional[str] = None
    
    equipments: List[InwardEquipmentResponse] = []

    model_config = ConfigDict(from_attributes=True)