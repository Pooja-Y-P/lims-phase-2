from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import date, datetime
 
 
class HTWUnPGMasterBase(BaseModel):
    set_pressure_min: float = Field(..., gt=0, description="Minimum set pressure")
    set_pressure_max: float = Field(..., gt=0, description="Maximum set pressure")
    uncertainty_percent: float = Field(..., gt=0, description="Un-PG in %")
    valid_upto: date
    is_active: bool = True
 
    @model_validator(mode="after")
    def validate_pressure_range(self):
        if self.set_pressure_min >= self.set_pressure_max:
            raise ValueError("set_pressure_min must be less than set_pressure_max")
        return self
 
 
class HTWUnPGMasterCreate(HTWUnPGMasterBase):
    pass
 
 
class HTWUnPGMasterUpdate(BaseModel):
    set_pressure_min: Optional[float] = Field(None, gt=0)
    set_pressure_max: Optional[float] = Field(None, gt=0)
    uncertainty_percent: Optional[float] = Field(None, gt=0)
    valid_upto: Optional[date]
    is_active: Optional[bool]
 
    @model_validator(mode="after")
    def validate_pressure_range(self):
        if (
            self.set_pressure_min is not None
            and self.set_pressure_max is not None
            and self.set_pressure_min >= self.set_pressure_max
        ):
            raise ValueError("set_pressure_min must be less than set_pressure_max")
        return self
 
 
class HTWUnPGMasterResponse(HTWUnPGMasterBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True
 
 