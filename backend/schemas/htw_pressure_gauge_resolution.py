from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date

# --- 1. Schema for Creation (Used by POST) ---
class HTWPressureGaugeResolutionCreate(BaseModel):
    pressure: float = Field(..., description="The pressure value")
    unit: str = Field(..., description="Unit of measurement (e.g., bar, psi)")
    valid_upto: Optional[date] = None
    is_active: bool = True

# --- 2. Schema for Response (Used by GET/POST response) ---
class HTWPressureGaugeResolutionResponse(BaseModel):
    id: Optional[int] = None 
    pressure: float
    unit: str
    valid_upto: Optional[date] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)