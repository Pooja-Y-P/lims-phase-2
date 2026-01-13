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
    # --- ADDED: Foreign Key to HTWMasterStandard ---
    master_standard_id: int
 
 
class HTWNomenclatureRangeCreate(HTWNomenclatureRangeBase):
    # Inherits all fields, including master_standard_id, from HTWNomenclatureRangeBase
    pass
 
 
class HTWNomenclatureRangeUpdate(BaseModel):
    # All fields should be optional for an update operation
    nomenclature: Optional[str] = None
    range_min: Optional[float] = None
    range_max: Optional[float] = None
    is_active: Optional[bool] = None
    valid_upto: Optional[datetime] = None  # Changed to datetime for consistency with Base
    # --- ADDED: Optional Foreign Key for update ---
    master_standard_id: Optional[int] = None
 
 
class HTWNomenclatureRangeResponse(HTWNomenclatureRangeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # master_standard_id is inherited from HTWNomenclatureRangeBase
 
    class Config:
        from_attributes = True # Pydantic v2 equivalent of orm_mode = True
 
 
class RangeMatchRequest(BaseModel):
    min_value: float = Field(..., description="Minimum value to match")
    max_value: float = Field(..., description="Maximum value to match")
 
 
class RangeMatchResponse(BaseModel):
    matched_nomenclatures: List[str] = Field(..., description="List of nomenclatures that match the range")
    min_matched: Optional[str] = Field(None, description="Nomenclature matching min_value")
    max_matched: Optional[str] = Field(None, description="Nomenclature matching max_value")
 