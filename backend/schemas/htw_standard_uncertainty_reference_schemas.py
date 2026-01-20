from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field
 
 
class HTWStandardUncertaintyReferenceBase(BaseModel):
    valid_from: date
    valid_upto: date
    torque_nm: int = Field(..., example=1500)
 
    applied_torque: Decimal
    indicated_torque: Decimal
    error_value: Decimal
    uncertainty_percent: Decimal
    is_active: bool = True
 
 
class HTWStandardUncertaintyReferenceCreate(
    HTWStandardUncertaintyReferenceBase
):
    pass
 
 
class HTWStandardUncertaintyReferenceUpdate(BaseModel):
    valid_from: Optional[date] = None
    valid_upto: Optional[date] = None
    torque_nm: Optional[int] = None
    applied_torque: Optional[Decimal] = None
    indicated_torque: Optional[Decimal] = None
    error_value: Optional[Decimal] = None
    uncertainty_percent: Optional[Decimal] = None
    is_active: Optional[bool] = None
 
 
class HTWStandardUncertaintyReferenceResponse(
    HTWStandardUncertaintyReferenceBase
):
    id: int
    created_at: datetime | None
    updated_at: datetime | None
 
    class Config:
        from_attributes = True