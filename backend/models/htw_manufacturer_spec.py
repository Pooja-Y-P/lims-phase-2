# backend/models/htw_manufacturer_spec.py

from sqlalchemy import Column, Integer, String, Numeric, Boolean, TIMESTAMP, func
from backend.db import Base


class HTWManufacturerSpec(Base):
    __tablename__ = "htw_manufacturer_spec"

    id = Column(Integer, primary_key=True, index=True)
    make = Column(String(255))
    model = Column(String(255))
    range_min = Column(Numeric)
    range_max = Column(Numeric)
    torque_20 = Column(Numeric)
    torque_40 = Column(Numeric)
    torque_60 = Column(Numeric)
    torque_80 = Column(Numeric)
    torque_100 = Column(Numeric)
    torque_unit = Column(String(50))
    pressure_20 = Column(Numeric)
    pressure_40 = Column(Numeric)
    pressure_60 = Column(Numeric)
    pressure_80 = Column(Numeric)
    pressure_100 = Column(Numeric)
    pressure_unit = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

