from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from backend.db import Base

class InwardEquipment(Base):
    __tablename__ = "inward_equipments"

    inward_eqp_id = Column(Integer, primary_key=True)
    inward_id = Column(Integer, ForeignKey("inward.inward_id", ondelete="CASCADE"))
    
    nepl_id = Column(String(100), unique=True, nullable=False, index=True)
    material_description = Column(String(500))
    make = Column(String(255))
    model = Column(String(255))
    range = Column(String(255))
    serial_no = Column(String(255))
    quantity = Column(Integer, default=1, nullable=False)
    visual_inspection_notes = Column(Text)
    photos = Column(JSONB)
    calibration_by = Column(String(50))
    supplier = Column(String(255))
    out_dc = Column(String(255))
    in_dc = Column(String(255))
    nextage_contract_reference = Column(String(255))
    
    qr_code = Column(Text)
    barcode = Column(Text)
    
    # ✅ Renamed column
    remarks_and_decision = Column(Text)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))

    inward = relationship("Inward", back_populates="equipments")
    srf_equipment = relationship(
        "SrfEquipment",
        back_populates="inward_equipment",
        uselist=False,
        cascade="all, delete-orphan"
    )
