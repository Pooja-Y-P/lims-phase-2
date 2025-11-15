from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional
from datetime import date

# --- Request Schemas ---

class AccountActivationRequest(BaseModel):
    """Schema for the request to set a password using an invitation token."""
    token: str
    password: str = Field(..., min_length=8, description="New password for the account")

class EquipmentRemarkUpdate(BaseModel):
    """Schema for a single equipment remark update."""
    inward_eqp_id: int
    # --- FIX: Change field name from 'remarks' to 'remarks_and_decision' ---
    remarks_and_decision: Optional[str] = ""

class RemarksSubmissionRequest(BaseModel):
    """Schema for submitting a list of remarks for an inward."""
    # This now correctly uses the updated EquipmentRemarkUpdate schema
    remarks: List[EquipmentRemarkUpdate]

# --- Response Schemas ---

class EquipmentForCustomer(BaseModel):
    """A simplified view of an Inward Equipment for the customer portal."""
    inward_eqp_id: int
    nepl_id: str
    material_description: Optional[str]
    make: Optional[str]
    model: Optional[str]
    serial_no: Optional[str]
    # --- FIX: Change field name from 'remarks' to 'remarks_and_decision' ---
    # Also add visual_inspection_notes so the frontend knows what is deviated
    visual_inspection_notes: Optional[str] = None
    remarks_and_decision: Optional[str] = None
    photos: Optional[List[str]] = None
    
    model_config = ConfigDict(from_attributes=True)

class InwardForCustomer(BaseModel):
    """A detailed view of an Inward for the customer, including equipment."""
    inward_id: int
    srf_no: int
    date: date
    status: str
    equipments: List[EquipmentForCustomer] = []
    
    model_config = ConfigDict(from_attributes=True)
    
class InwardListItemForCustomer(BaseModel):
    """A summarized view of an Inward for listing purposes."""
    inward_id: int
    srf_no: int
    date: date
    status: str
    equipment_count: int

class CustomerInwardListResponse(BaseModel):
    """The response model for the list of a customer's inwards."""
    inwards: List[InwardListItemForCustomer]

class CustomerSchema(BaseModel):
    """Schema for customer data, including contact details."""
    customer_id: int
    customer_details: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None

    model_config = ConfigDict(from_attributes=True)

class CustomerDropdownResponse(BaseModel):
    """Schema for customer data to be used in dropdowns."""
    customer_id: int
    customer_details: str

    model_config = ConfigDict(from_attributes=True)
