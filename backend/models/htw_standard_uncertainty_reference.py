from sqlalchemy import Column, Integer, Numeric, Boolean, Date, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from backend.db import Base 

class HTWStandardUncertaintyReference(Base):
    __tablename__ = "htw_standard_uncertainty_reference"

    id = Column(Integer, primary_key=True, index=True)
    valid_from = Column(Date, nullable=False)
    valid_upto = Column(Date, nullable=False)
    
    # Torque band infouncertainty_percent
    torque_nm = Column(Integer, nullable=False) 
    
    # Reference values
    applied_torque = Column(Numeric(14, 4), nullable=False)
    indicated_torque = Column(Numeric(14, 4), nullable=False)
    error_value = Column(Numeric(18, 8), nullable=False)
    uncertainty_percent = Column(Numeric(8, 4), nullable=False)

    # --- THIS WAS MISSING ---
    is_active = Column(Boolean, default=True) 
    # ------------------------

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())