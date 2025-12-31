# backend/models/htw_master_standard.py

from sqlalchemy import Column, Integer, String, Numeric, Date, Boolean, TIMESTAMP, func
from backend.db import Base


class HTWMasterStandard(Base):
    __tablename__ = "htw_master_standard"

    id = Column(Integer, primary_key=True, index=True)
    nomenclature = Column(String(255), nullable=False)
    range_min = Column(Numeric)
    range_max = Column(Numeric)
    range_unit = Column(String(50))
    manufacturer = Column(String(255))
    model_serial_no = Column(String(255))
    traceable_to_lab = Column(String(255))
    uncertainty = Column(Numeric)
    uncertainty_unit = Column(String(50))
    certificate_no = Column(String(255))
    calibration_valid_upto = Column(Date)
    accuracy_of_master = Column(String(255))
    resolution = Column(Numeric)
    resolution_unit = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

