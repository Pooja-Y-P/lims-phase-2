from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
 
 
class HTWConstCoverageFactorBase(BaseModel):
    k: float = Field(..., gt=0, description="Coverage factor (e.g. 2.0)")
    is_active: bool = True
 
 
class HTWConstCoverageFactorCreate(HTWConstCoverageFactorBase):
    pass
 
 
class HTWConstCoverageFactorUpdate(BaseModel):
    k: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None
 
 
class HTWConstCoverageFactorResponse(HTWConstCoverageFactorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True
 
 