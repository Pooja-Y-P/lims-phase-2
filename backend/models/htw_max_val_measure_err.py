from sqlalchemy import Column, Integer, Numeric, Boolean, TIMESTAMP, func
from backend.db import Base
 
 
class HTWMaxValMeasureErr(Base):
    __tablename__ = "htw_max_val_measure_err"
 
    id = Column(Integer, primary_key=True, index=True)
 
    range_min = Column(Numeric(14, 4), nullable=False)
    range_max = Column(Numeric(14, 4), nullable=False)
 
    un_percent = Column(Numeric(8, 4), nullable=False)
 
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
 