# backend/schemas/htw_nomenclature_range_schemas.py

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class HTWNomenclatureRangeBase(BaseModel):
    nomenclature: str
    range_min: float
    range_max: float
    is_active: bool = True
    valid_upto: Optional[datetime] = None



class HTWNomenclatureRangeCreate(HTWNomenclatureRangeBase):
    pass


class HTWNomenclatureRangeUpdate(BaseModel):
    nomenclature: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    is_active: Optional[bool] = None
    valid_upto: Optional[date] = None


class HTWNomenclatureRangeResponse(HTWNomenclatureRangeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RangeMatchRequest(BaseModel):
    min_value: float = Field(..., description="Minimum value to match")
    max_value: float = Field(..., description="Maximum value to match")


class RangeMatchResponse(BaseModel):
    matched_nomenclatures: List[str] = Field(..., description="List of nomenclatures that match the range")
    min_matched: Optional[str] = Field(None, description="Nomenclature matching min_value")
    max_matched: Optional[str] = Field(None, description="Nomenclature matching max_value")

