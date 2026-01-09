# backend/schemas/htw_pressure_gauge_resolution.py

from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import date


class HTWPressureGaugeResolutionResponse(BaseModel):
    pressure: float
    unit: str
    valid_upto: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)

