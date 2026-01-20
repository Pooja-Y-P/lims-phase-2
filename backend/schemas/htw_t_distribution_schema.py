from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
 
 
class HTWTDistributionBase(BaseModel):
    degrees_of_freedom: int = Field(..., ge=1)
    confidence_level: float = Field(..., gt=0)
    alpha: float = Field(..., gt=0)
    t_value: float = Field(..., gt=0)
    is_active: bool = True
 
 
class HTWTDistributionCreate(HTWTDistributionBase):
    pass
 
 
class HTWTDistributionUpdate(BaseModel):
    degrees_of_freedom: Optional[int] = None
    confidence_level: Optional[float] = None
    alpha: Optional[float] = None
    t_value: Optional[float] = None
    is_active: Optional[bool] = None
 
 
class HTWTDistributionResponse(HTWTDistributionBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True
 
 