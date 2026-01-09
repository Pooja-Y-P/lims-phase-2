# backend/models/htw_pressure_gauge_resolution.py

from sqlalchemy import Column, Integer, Numeric, Text, Boolean, Date, DateTime
from sqlalchemy.sql import func
from backend.db import Base


class HTWPressureGaugeResolution(Base):
    __tablename__ = "htw_pressure_gauge_resolution"

    id = Column(Integer, primary_key=True, index=True)
    pressure = Column(Numeric(14, 4), nullable=False)
    unit = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    valid_upto = Column(Date)

