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
    customer_remark: Optional[str] = ""
    # Optional: allow passing specific status if needed, though backend logic handles it
    status: Optional[str] = None 

class RemarksSubmissionRequest(BaseModel):
    """Schema for submitting a list of remarks for an inward."""
    remarks: List[EquipmentRemarkUpdate]
    # Optional: allow passing overall status update (e.g. to 'reviewed')
    status: Optional[str] = None

# --- Response Schemas ---

class EquipmentForCustomer(BaseModel):
    """A simplified view of an Inward Equipment for the customer portal."""
    inward_eqp_id: int
    nepl_id: str
    material_description: Optional[str]
    make: Optional[str]
    range: Optional[str] = None
    model: Optional[str]
    serial_no: Optional[str]
    
    visual_inspection_notes: Optional[str] = None
    
    # Engineer remarks included for display
    engineer_remarks: Optional[str] = None 
    
    # Customer remarks mapping
    customer_remarks: Optional[str] = Field(None, alias='customer_remarks')
    
    remarks_and_decision: Optional[str] = None
    photos: Optional[List[str]] = None
    
    # --- Added status to track 'pending' vs 'reviewed' per item ---
    status: Optional[str] = None 
    
    model_config = ConfigDict(from_attributes=True)

class InwardForCustomer(BaseModel):
    """A detailed view of an Inward for the customer, including equipment."""
    inward_id: int
    srf_no: str
    
    # Date handling
    material_inward_date: Optional[date] = None
    date: Optional[date] = None # Fallback for some UI logic
    created_at: Optional[datetime] = None # Fallback
    
    status: str
    customer_dc_no: Optional[str] = None # Added for display in portal header
    
    equipments: List[EquipmentForCustomer] = []
    
    model_config = ConfigDict(from_attributes=True)
    
class InwardListItemForCustomer(BaseModel):
    """A summarized view of an Inward for listing purposes."""
    inward_id: int
    srf_no: str
    material_inward_date: date
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
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    ship_to_address: Optional[str] = None
    bill_to_address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)