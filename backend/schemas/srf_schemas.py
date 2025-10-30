# file: backend/schemas/srf_schemas.py

from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import date, datetime

# ====================================================================
# Nested Schemas (No Changes)
# ====================================================================

class CustomerSchema(BaseModel):
    customer_id: int
    customer_details: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SrfEquipmentSchema(BaseModel):
    srf_eqp_id: Optional[int] = None
    unit: Optional[str] = None
    no_of_calibration_points: Optional[int] = None
    mode_of_calibration: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class InwardEquipmentSchema(BaseModel):
    inward_eqp_id: int
    nepl_id: str
    material_description: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    range: Optional[str] = None
    serial_no: Optional[str] = None
    quantity: int
    srf_equipment: Optional[SrfEquipmentSchema] = None
    model_config = ConfigDict(from_attributes=True)

class InwardSchema(BaseModel):
    inward_id: int
    equipments: List[InwardEquipmentSchema] = []
    customer: Optional[CustomerSchema] = None
    model_config = ConfigDict(from_attributes=True)

# ====================================================================
# Base & Create Schemas (No Changes)
# ====================================================================

class SrfBase(BaseModel):
    srf_no: int
    date: date
    nepl_srf_no: Optional[str] = None
    telephone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: str = 'created'

class SrfCreate(SrfBase):
    inward_id: int

# ====================================================================
# Update Schemas (CORRECTED)
# ====================================================================

class SrfEquipmentUpdateSchema(BaseModel):
    inward_eqp_id: int
    unit: Optional[str] = None
    no_of_calibration_points: Optional[int] = None
    mode_of_calibration: Optional[str] = None

class SrfDetailUpdate(BaseModel):
    """
    FIXED: This schema now accepts ALL fields the frontend will send.
    This ensures that when a manager approves the SRF, all the special
    instruction details are captured in the PUT request and saved to the DB.
    'specified_frequency' is removed to avoid confusion. The frontend will send
    the final string value in 'calibration_frequency'.
    """
    telephone: Optional[str] = None
    nepl_srf_no: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: Optional[str] = None
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None

    # --- Special Instructions Fields ---
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None # Correct name
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = Field(default=None, max_length=100)

# ====================================================================
# Response Models (Correct)
# ====================================================================

class SrfResponse(BaseModel):
    srf_id: int
    srf_no: int
    nepl_srf_no: Optional[str] = None
    status: str
    created_at: datetime
    inward_id: int
    customer_name: Optional[str] = None
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None   # ✅ Add this
    model_config = ConfigDict(from_attributes=True)


class Srf(SrfBase):
    """
    This is the main response model. 'specified_frequency' is correctly omitted
    as it does not have a corresponding column in the database table.
    The single 'calibration_frequency' field holds either "As per Standard" or the custom value.
    """
    srf_id: int
    inward_id: int
    nepl_srf_no: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    inward: Optional[InwardSchema] = None
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None   # ✅ Add this
    model_config = ConfigDict(from_attributes=True)


class SrfSummary(BaseModel):
    srf_id: int
    srf_no: int
    date: date
    status: str
    customer_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)