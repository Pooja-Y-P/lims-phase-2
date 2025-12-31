# backend/schemas/htw_manufacturer_spec_schemas.py

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class HTWManufacturerSpecBase(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    torque_20: Optional[float] = None
    torque_40: Optional[float] = None
    torque_60: Optional[float] = None
    torque_80: Optional[float] = None
    torque_100: Optional[float] = None
    torque_unit: Optional[str] = None
    pressure_20: Optional[float] = None
    pressure_40: Optional[float] = None
    pressure_60: Optional[float] = None
    pressure_80: Optional[float] = None
    pressure_100: Optional[float] = None
    pressure_unit: Optional[str] = None
    is_active: bool = True


class HTWManufacturerSpecCreate(HTWManufacturerSpecBase):
    pass


class HTWManufacturerSpecUpdate(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    torque_20: Optional[float] = None
    torque_40: Optional[float] = None
    torque_60: Optional[float] = None
    torque_80: Optional[float] = None
    torque_100: Optional[float] = None
    torque_unit: Optional[str] = None
    pressure_20: Optional[float] = None
    pressure_40: Optional[float] = None
    pressure_60: Optional[float] = None
    pressure_80: Optional[float] = None
    pressure_100: Optional[float] = None
    pressure_unit: Optional[str] = None
    is_active: Optional[bool] = None


class HTWManufacturerSpecResponse(HTWManufacturerSpecBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

