from sqlalchemy import Column, Integer, Numeric, Boolean, TIMESTAMP, func
from backend.db import Base
 
 
class HTWCMCReference(Base):
    __tablename__ = "htw_cmc_reference"
 
    id = Column(Integer, primary_key=True, index=True)
 
    lower_measure_range = Column(Numeric(14, 4), nullable=False)
    higher_measure_range = Column(Numeric(14, 4), nullable=False)
 
    cmc_percent = Column(Numeric(8, 4), nullable=False)
 
    is_active = Column(Boolean, default=True)
 
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
 