from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
 
 
class HTWMaxValMeasureErrBase(BaseModel):
    range_min: float = Field(..., example=100)
    range_max: float = Field(..., example=1500)
    un_percent: float = Field(..., example=0.15)
    is_active: bool = True
 
 
class HTWMaxValMeasureErrCreate(HTWMaxValMeasureErrBase):
    pass
 
 
class HTWMaxValMeasureErrUpdate(BaseModel):
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    un_percent: Optional[float] = None
    is_active: Optional[bool] = None
 
 
class HTWMaxValMeasureErrResponse(HTWMaxValMeasureErrBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True
 