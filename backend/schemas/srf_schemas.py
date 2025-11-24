from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Union
from datetime import date, datetime

# ====================================================================
# Nested Schemas
# ====================================================================

class CustomerSchema(BaseModel):
    customer_id: int
    customer_details: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    bill_to_address: Optional[str] = None
    ship_to_address: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)


class SrfEquipmentSchema(BaseModel):
    srf_eqp_id: int
    unit: Optional[str] = None
    no_of_calibration_points: Optional[str] = None 
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
    srf_no: Optional[str] = None 
    customer_dc_no: Optional[str] = None
    customer_dc_date: Optional[str] = None
    material_inward_date: Optional[date] = None
   
    model_config = ConfigDict(from_attributes=True)


# ====================================================================
# Base, Create, and Update Schemas
# ====================================================================

class SrfBase(BaseModel):
    """
    Base fields common to SRF operations.
    """
    srf_no: Union[int, str]
    date: date
    nepl_srf_no: Optional[str] = None
    telephone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: str = 'created'
    is_draft: bool = False  # Added draft flag


class SrfEquipmentUpdateSchema(BaseModel):
    inward_eqp_id: int
    unit: Optional[str] = None
    no_of_calibration_points: Optional[str] = None 
    mode_of_calibration: Optional[str] = None


class SrfCreate(SrfBase):
    inward_id: int
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None
    
    # Optional fields for initial creation
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None


class SrfDetailUpdate(BaseModel):
    telephone: Optional[str] = None
    nepl_srf_no: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: Optional[str] = None
    is_draft: Optional[bool] = None
   
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None

    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = Field(default=None, max_length=100)
    date: Optional[date] = None


# ====================================================================
# Response Schemas
# ====================================================================

class Srf(SrfBase):
    srf_id: int
    inward_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
   
    inward: Optional[InwardSchema] = None
   
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None
    is_draft: bool = False
   
    model_config = ConfigDict(from_attributes=True)


class SrfSummary(BaseModel):
    srf_id: int
    srf_no: Union[int, str]
    date: date
    status: str
    is_draft: bool = False
    customer_name: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)


class SrfResponse(BaseModel):
    srf_id: int
    srf_no: Union[int, str]
    nepl_srf_no: Optional[str] = None
    status: str
    created_at: datetime
    inward_id: int
    customer_name: Optional[str] = None
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    remarks: Optional[str] = None
    is_draft: bool = False
   
    model_config = ConfigDict(from_attributes=True)

# --- FIXED: Added the missing class causing ImportError ---
class SrfApiResponse(BaseModel):
    pending: List[SrfResponse]
    approved: List[SrfResponse]
    rejected: List[SrfResponse]