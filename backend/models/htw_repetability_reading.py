from sqlalchemy import Column, Integer, Numeric, TIMESTAMP, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.db import Base

class HTWRepeatabilityReading(Base):
    __tablename__ = "htw_repeatability_reading"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    repeatability_id = Column(Integer, ForeignKey("htw_repeatability.id", ondelete="CASCADE"), nullable=False)
    
    reading_order = Column(Integer, nullable=False)
    indicated_reading = Column(Numeric(14, 4), nullable=False)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint('repeatability_id', 'reading_order', name='htw_repeatability_reading_key'),
    )

    # Relationship back to Header
    header = relationship("HTWRepeatability", back_populates="readings")