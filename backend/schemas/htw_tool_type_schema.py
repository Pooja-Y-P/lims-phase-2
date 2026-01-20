from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from typing_extensions import Literal
 
 
class HTWToolTypeBase(BaseModel):
    tool_name: str = Field(..., example="Hydraulic torque wrench")
    tool_category: str = Field(..., example="Tool Type 1")
    operation_type: Literal["Indicating", "Setting"]
    classification: Optional[str] = Field(None, example="Type I Class C")
    is_active: bool = True
 
 
class HTWToolTypeCreate(HTWToolTypeBase):
    pass
 
 
class HTWToolTypeUpdate(BaseModel):
    tool_name: Optional[str] = None
    tool_category: Optional[str] = None
    operation_type: Optional[Literal["Indicating", "Setting"]] = None
    classification: Optional[str] = None
    is_active: Optional[bool] = None
 
 
class HTWToolTypeResponse(HTWToolTypeBase):
    id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
 
    class Config:
        from_attributes = True