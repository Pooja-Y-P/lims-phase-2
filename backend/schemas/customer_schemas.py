from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional
from datetime import date, datetime

# --- Request Schemas ---

class AccountActivationRequest(BaseModel):
    """Schema for the request to set a password using an invitation token."""
    token: str
    password: str = Field(..., min_length=8, description="New password for the account")

class EquipmentRemarkUpdate(BaseModel):
    """Schema for a single equipment remark update."""
    inward_eqp_id: int
    remarks: Optional[str] = ""

class RemarksSubmissionRequest(BaseModel):
    """Schema for submitting a list of remarks for an inward."""
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
    remarks: Optional[str]
    
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