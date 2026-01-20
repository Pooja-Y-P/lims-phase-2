from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, Date,
    TIMESTAMP, ForeignKey, func
)
from sqlalchemy.orm import relationship
from backend.db import Base
 
 
class HTWNomenclatureRange(Base):
    __tablename__ = "htw_nomenclature_range"
 
    id = Column(Integer, primary_key=True, index=True)
 
    master_standard_id = Column(
        Integer,
        ForeignKey("htw_master_standard.id", ondelete="RESTRICT"),
        nullable=False,
    
    )
 
    range_min = Column(Numeric(14, 4), nullable=False)
    range_max = Column(Numeric(14, 4), nullable=False)
 
    nomenclature = Column(String(255), nullable=False, unique=True)
 
    is_active = Column(Boolean, default=True)
    valid_upto = Column(Date)
 
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
 
    master_standard = relationship(
        "HTWMasterStandard",
        back_populates="nomenclature_range"
    )
 