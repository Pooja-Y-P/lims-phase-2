# backend/models/srf.py

from sqlalchemy import Column, Integer, String, Text, Boolean, Date, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship

from backend.db import Base

class Srf(Base):
    __tablename__ = "srfs"

    srf_id = Column(Integer, primary_key=True)
    # UPDATED: Added index=True to explicitly match the 'idx_srfs_inward_id' index in the SQL schema.
    # While unique=True implicitly creates an index, this makes the mapping more direct.
    inward_id = Column(Integer, ForeignKey("inward.inward_id", ondelete="CASCADE"), unique=True, index=True)
    srf_no = Column(Integer, nullable=False)
    nepl_srf_no = Column(String(100), unique=True)
    date = Column(Date, nullable=False)
    telephone = Column(String(50))
    contact_person = Column(String(255))
    email = Column(String(320))
    certificate_issue_name = Column(String(255))
    calibration_frequency = Column(String(100))
    statement_of_conformity = Column(Boolean, default=False)
    ref_iso_is_doc = Column(Boolean, default=False)
    ref_manufacturer_manual = Column(Boolean, default=False)
    ref_customer_requirement = Column(Boolean, default=False)
    turnaround_time = Column(Integer, default=7)
    remark_special_instructions = Column(Text)
    customer_approval = Column(String(50))
    status = Column(String(50), default="created")
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True))

    # --- Relationships ---
    # One-to-One: An SRF belongs to exactly one inward.
    inward = relationship("Inward", back_populates="srf")
    
    # One-to-Many: An SRF has multiple equipment line items.
    equipments = relationship("SrfEquipment", back_populates="srf", cascade="all, delete-orphan")