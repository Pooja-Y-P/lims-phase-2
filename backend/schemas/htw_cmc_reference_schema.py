from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
 
 
class HTWCMCReferenceBase(BaseModel):
    lower_measure_range: float = Field(..., example=200)
    higher_measure_range: float = Field(..., example=1500)
    cmc_percent: float = Field(..., example=0.58)
    is_active: bool = True
 
 
class HTWCMCReferenceCreate(HTWCMCReferenceBase):
    pass
 
 
class HTWCMCReferenceUpdate(BaseModel):
    lower_measure_range: Optional[float] = None
    higher_measure_range: Optional[float] = None
    cmc_percent: Optional[float] = None
    is_active: Optional[bool] = None
 
 
class HTWCMCReferenceResponse(HTWCMCReferenceBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True