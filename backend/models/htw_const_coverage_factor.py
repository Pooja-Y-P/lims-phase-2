#htw_const_coverage_factor.py
from sqlalchemy import Column, Integer, Numeric, Boolean, TIMESTAMP, func
from backend.db import Base
 
 
class HTWConstCoverageFactor(Base):
    __tablename__ = "htw_const_coverage_factor"
 
    id = Column(Integer, primary_key=True, index=True)
 
    k = Column(Numeric(6, 4), nullable=False)
 
    is_active = Column(Boolean, default=True)
 
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=func.now()
    )