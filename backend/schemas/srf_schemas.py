from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator
from typing import List, Optional, Union, Any
from datetime import date, datetime
 
# ====================================================================
# Nested Schemas
# ====================================================================
 
class CustomerSchema(BaseModel):
    """Represents customer details linked to an SRF."""
    customer_id: int
    customer_details: Optional[str] = None # This is the Company Name
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
   
    # Added Address fields so they can be fetched
    bill_to_address: Optional[str] = None
    ship_to_address: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 
class InwardListSummary(BaseModel):
    inward_id: int
    status: Optional[str] = None
    customer_dc_no: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

 
class SrfEquipmentSchema(BaseModel):
    srf_eqp_id: int
    unit: Optional[str] = None
    # Changed to str to handle "5" or "5 points" from UI
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

    # ✅ ✅ ✅ ADD THIS LINE (CRITICAL FIX)
    status: Optional[str] = None

    srf_equipment: Optional[SrfEquipmentSchema] = None
   
    model_config = ConfigDict(from_attributes=True)

 
 
class InwardSchema(BaseModel):
    inward_id: int

    # ✅ Keep original
    equipments: List[InwardEquipmentSchema] = []

    # ✅ Add ALIAS for frontend compatibility
    inward_equipments: Optional[List[InwardEquipmentSchema]] = None

    customer: Optional[CustomerSchema] = None
    customer_dc_no: Optional[str] = None
    customer_dc_date: Optional[date] = None
    material_inward_date: Optional[datetime] = None
    status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def sync_equipments_alias(self):
        if self.inward_equipments is None:
            self.inward_equipments = self.equipments
        return self

    
    @field_validator('customer_dc_date', mode='before')
    @classmethod
    def parse_customer_dc_date(cls, v):
        """Handle empty strings and string dates from database."""
        if v is None or v == '':
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                # Try parsing as date string (YYYY-MM-DD format)
                return datetime.strptime(v, '%Y-%m-%d').date()
            except (ValueError, TypeError):
                # If parsing fails, return None
                return None
        return v
 
 
# ====================================================================
# Base Schema
# ====================================================================
 
class SrfBase(BaseModel):
    """Base fields common across SRF operations."""
    # Changed from int to str to support 'NEPL...' format
    srf_no: str
    date: date
    nepl_srf_no: Optional[str] = None
   
    # These fields act as overrides if the SRF data differs from Customer data
    telephone: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    certificate_issue_adress: Optional[str] = None
    status: str = 'created'
 
    # Validator to handle cases where srf_no comes as int
    @field_validator('srf_no', mode='before')
    @classmethod
    def stringify_srf_no(cls, v):
        return str(v) if v is not None else v
 
 
# ====================================================================
# Update Schemas (Robust - Ignores Extra Fields)
# ====================================================================
 
class SrfEquipmentUpdateSchema(BaseModel):
    inward_eqp_id: int
    srf_eqp_id: Optional[int] = None
    unit: Optional[str] = None
    # Flexible type for calibration points
    no_of_calibration_points: Optional[Union[str, int]] = None
    mode_of_calibration: Optional[str] = None
 
    # CRITICAL: Ignore extra fields React might send inside the equipment object
    model_config = ConfigDict(extra='ignore')
 
    @field_validator('no_of_calibration_points', mode='before')
    @classmethod
    def to_string_points(cls, v):
        return str(v) if v is not None else None
 
 
class SrfCreate(SrfBase):
    inward_id: int
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None
 
 
class SrfDetailUpdate(BaseModel):
    # Fields React might send that we don't strictly update, but must accept to avoid 422
    srf_no: Optional[Union[str, int]] = None
    date: Optional[Any] = None
    inward_id: Optional[int] = None
 
    # Updatable Fields
    telephone: Optional[str] = None
    nepl_srf_no: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    certificate_issue_name: Optional[str] = None
    certificate_issue_adress: Optional[str] = None
    status: Optional[str] = None
    equipments: Optional[List[SrfEquipmentUpdateSchema]] = None
   
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remark_special_instructions: Optional[str] = None
    remarks: Optional[str] = None
 
    # CRITICAL: Ignore any other fields React sends (like inward object, srf_id, etc.)
    model_config = ConfigDict(extra='ignore')
 
 
# ====================================================================
# Response Schemas - For API output serialization
# ====================================================================
 
class Srf(SrfBase):
    """
    The main, fully-detailed response model for a single SRF.
    """
    srf_id: int
    inward_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
   
    # Flattened Customer Details for Frontend convenience
    customer_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    address: Optional[str] = None
 
    # Fully nested Inward object
    inward: Optional[InwardSchema] = None
   
    # Special Instructions Fields
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    ref_iso_is_doc: Optional[bool] = None
    ref_manufacturer_manual: Optional[bool] = None
    ref_customer_requirement: Optional[bool] = None
    turnaround_time: Optional[int] = None
    remarks: Optional[str] = None
   
    model_config = ConfigDict(from_attributes=True)
 
    @model_validator(mode='after')
    def flatten_customer_info(self):
        """
        Automatically populates top-level fields from the nested inward.customer object
        if they haven't been manually set on the SRF itself.
        """
        if self.inward and self.inward.customer:
            customer = self.inward.customer
           
            # 1. Set Company Name
            if not self.customer_name: self.customer_name = customer.customer_details
           
            # 2. Set Contact Info (if not overridden)
            if not self.contact_person: self.contact_person = customer.contact_person
            if not self.email: self.email = customer.email
            if not self.telephone: self.telephone = customer.phone
           
            # 3. Set Address (Prioritize Bill To, then Ship To)
            if not self.address:
                self.address = customer.bill_to_address or customer.ship_to_address
 
        return self
 
 
class SrfSummary(BaseModel):
    """A lightweight summary model for listing multiple SRFs."""
    srf_id: int
    srf_no: str
    date: date
    status: str
    customer_name: Optional[str] = None
    inward: Optional[InwardListSummary] = None
    
    @field_validator('srf_no', mode='before')
    @classmethod
    def stringify_srf(cls, v):
        return str(v)
   
    model_config = ConfigDict(from_attributes=True)
 
 
class SrfResponse(BaseModel):
    """
    For Customer Portal View.
    """
    srf_id: int
    srf_no: str
    nepl_srf_no: Optional[str] = None
    status: str
    created_at: datetime
    inward_id: int
   
    # Flattened Customer Details
    customer_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    address: Optional[str] = None
 
    calibration_frequency: Optional[str] = None
    statement_of_conformity: Optional[bool] = None
    remarks: Optional[str] = None
    remark_special_instructions: Optional[str] = None
    # Need inward to extract customer details, but we exclude it from final JSON for security/cleanliness
    inward: Optional[InwardSchema] = Field(default=None)
 
    model_config = ConfigDict(from_attributes=True)
    
    # --- ADDED FIX HERE: VALIDATE srf_no TO STRING ---
    @field_validator('srf_no', mode='before')
    @classmethod
    def stringify_srf_no(cls, v):
        return str(v)
    # -------------------------------------------------

    @model_validator(mode='after')
    def flatten_portal_info(self):
        """Extracts customer info from the hidden inward relationship."""
        if self.inward and self.inward.customer:
            customer = self.inward.customer
            self.customer_name = customer.customer_details
            self.contact_person = customer.contact_person
            self.email = customer.email
            self.telephone = customer.phone
            self.address = customer.bill_to_address or customer.ship_to_address
        return self
 
 
class SrfApiResponse(BaseModel):
    """
    Defines the structure for the GET /portal/srfs endpoint response.
    """
    pending: List[SrfResponse]
    approved: List[SrfResponse]
    rejected: List[SrfResponse]