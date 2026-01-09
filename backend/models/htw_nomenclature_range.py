# backend/models/htw_nomenclature_range.py

from sqlalchemy import Column, Integer, String, Numeric, Date, Boolean, TIMESTAMP, func
from backend.db import Base


class HTWNomenclatureRange(Base):
    __tablename__ = "htw_nomenclature_range"

    id = Column(Integer, primary_key=True, index=True)
    nomenclature = Column(String(255), nullable=False)
    range_min = Column(Numeric, nullable=False)
    range_max = Column(Numeric, nullable=False)
    is_active = Column(Boolean, default=True)
    valid_upto = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

