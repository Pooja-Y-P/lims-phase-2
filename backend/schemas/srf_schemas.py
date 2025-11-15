# file: backend/schemas/srf_schemas.py
 
"""
Pydantic schemas for Service Request Forms (SRFs).
 
This file defines the data structures for creating, updating, and responding with
SRF data. It includes nested schemas for related entities like customers and equipment,
and it provides different "views" of the data for different API endpoints.
"""
 
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import date, datetime
 
# ====================================================================
# Nested Schemas - Reusable building blocks for more complex schemas
# ====================================================================
 
class CustomerSchema(BaseModel):
    """Represents basic customer details linked to an SRF."""
    customer_id: int
    customer_details: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 
 
class SrfEquipmentSchema(BaseModel):
    """Represents the SRF-specific details for a piece of equipment in a response."""
    srf_eqp_id: int
    unit: Optional[str] = None
    no_of_calibration_points: Optional[int] = None
    mode_of_calibration: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 
 
class InwardEquipmentSchema(BaseModel):
    """Represents an equipment item from the original inward record, including its SRF details."""
    inward_eqp_id: int
    nepl_id: str
    material_description: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    range: Optional[str] = None
    serial_no: Optional[str] = None
    quantity: int
   
    # This holds the one-to-one relationship for SRF-specific equipment details
    srf_equipment: Optional[SrfEquipmentSchema] = None
   
    model_config = ConfigDict(from_attributes=True)
 
 
class InwardSchema(BaseModel):
    """Represents the full inward record linked to an SRF, including its equipments and customer."""
    inward_id: int
    equipments: List[InwardEquipmentSchema] = []
    customer: Optional[CustomerSchema] = None
   
    model_config = ConfigDict(from_attributes=True)
 
 
# ====================================================================
# Base, Create, and Update Schemas - For API input validation (payloads)
# ====================================================================
 
class SrfBase(BaseModel):
    """Base fields that are common across SRF operations."""
    srf_no: int
    date: date
    nepl_srf_no: Optional[str] = None
    # Removed these fields from SrfBase as they will be populated from the Inward's customer
    telephone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: str = 'created'
   
 
class SrfEquipmentUpdateSchema(BaseModel):
    """
    Schema for the data payload when creating or updating SRF equipment details.
    This is what the frontend sends inside the `equipments` array.
    """
    inward_eqp_id: int  # The link back to the original equipment
    unit: Optional[str] = None
    no_of_calibration_points: Optional[int] = None
    mode_of_calibration: Optional[str] = None
 
 
class SrfCreate(SrfBase):
    """
    Schema for creating a new SRF (used by POST /srfs).
    Includes an 'equipments' list to allow saving equipment details during creation.
    """
    inward_id: int
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None
 
 
class SrfDetailUpdate(BaseModel):
    """
    Schema for updating an existing SRF (used by PUT /srfs/{srf_id}).
    All fields are optional to allow for partial updates.
    """
    # General SRF fields
    # Removed these fields as they will be populated from the Inward's customer
    telephone: Optional[str] = None
    nepl_srf_no: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    status: Optional[str] = None
   
    # Nested equipment details
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None
 
    # Special Instructions fields (from customer or manager)
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = Field(default=None, max_length=100)
 
 
# ====================================================================
# Response Schemas - For API output serialization (what the API returns)
# ====================================================================
 
class Srf(SrfBase):
    """
    The main, fully-detailed response model for a single SRF.
    This is what the GET /srfs/{srf_id} endpoint returns for detail pages.
    """
    srf_id: int
    inward_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
   
    # Fully nested Inward object containing customer and equipment details
    inward: Optional[InwardSchema] = None
   
    # All Special Instructions Fields
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 
 
class SrfSummary(BaseModel):
    """A lightweight summary model for listing multiple SRFs (e.g., in a table)."""
    srf_id: int
    srf_no: int
    date: date
    status: str
    customer_name: Optional[str] = None # Denormalized for easy display
   
    model_config = ConfigDict(from_attributes=True)
 
 
class SrfResponse(BaseModel):
    """
    A specific response model used by the customer portal to list SRFs.
    This contains the exact fields needed by that endpoint, including some special instructions.
    """
    srf_id: int
    srf_no: int
    nepl_srf_no: Optional[str] = None
    status: str
    created_at: datetime
    inward_id: int
    customer_name: Optional[str] = None
   
    # Added fields that the customer portal route requires
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    remarks: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 

class SrfApiResponse(BaseModel):
    """
    Defines the structure for the GET /portal/srfs endpoint response,
    categorizing SRFs by their status.
    """
    pending: List[SrfResponse]
    approved: List[SrfResponse]
    rejected: List[SrfResponse]
