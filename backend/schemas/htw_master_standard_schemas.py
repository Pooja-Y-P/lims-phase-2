# backend/schemas/htw_master_standard_schemas.py
 
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
 
 
class HTWMasterStandardBase(BaseModel):
    nomenclature: str = Field(..., description="Nomenclature of the master standard")
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_unit: Optional[str] = None
    manufacturer: Optional[str] = None
    model_serial_no: Optional[str] = None
    traceable_to_lab: Optional[str] = None
    uncertainty: Optional[float] = None
    uncertainty_unit: Optional[str] = None
    certificate_no: Optional[str] = None
    calibration_valid_upto: Optional[date] = None
    accuracy_of_master: Optional[str] = None
    resolution: Optional[float] = None
    resolution_unit: Optional[str] = None
    is_active: bool = True
 
 
class HTWMasterStandardCreate(HTWMasterStandardBase):
    pass
 
 
class HTWMasterStandardUpdate(BaseModel):
    nomenclature: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    range_unit: Optional[str] = None
    manufacturer: Optional[str] = None
    model_serial_no: Optional[str] = None
    traceable_to_lab: Optional[str] = None
    uncertainty: Optional[float] = None
    uncertainty_unit: Optional[str] = None
    certificate_no: Optional[str] = None
    calibration_valid_upto: Optional[date] = None
    accuracy_of_master: Optional[str] = None
    resolution: Optional[float] = None
    resolution_unit: Optional[str] = None
    is_active: Optional[bool] = None
 
 
class HTWMasterStandardResponse(HTWMasterStandardBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
 
    class Config:
        from_attributes = True
 
 
 
 
 