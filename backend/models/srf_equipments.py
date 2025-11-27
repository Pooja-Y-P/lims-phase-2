# backend/models/srf_equipment.py

from sqlalchemy import Column, Integer, Text,String, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship

from backend.db import Base

class SrfEquipment(Base):
    __tablename__ = "srf_equipments"

    srf_eqp_id = Column(Integer, primary_key=True, index=True)
    srf_id = Column(Integer, ForeignKey("srfs.srf_id", ondelete="CASCADE"))
    inward_eqp_id = Column(Integer, ForeignKey("inward_equipments.inward_eqp_id", ondelete="CASCADE"), unique=True)
    unit = Column(Text)
    status = Column(String(50), default='pending')
    no_of_calibration_points = Column(Integer)
    mode_of_calibration = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

    # --- Relationships ---
    # Many-to-One: An SRF equipment line item belongs to one SRF.
    srf = relationship("Srf", back_populates="equipments")
    
    # One-to-One: An SRF equipment line item corresponds to one inward equipment.
    inward_equipment = relationship("InwardEquipment", back_populates="srf_equipment")