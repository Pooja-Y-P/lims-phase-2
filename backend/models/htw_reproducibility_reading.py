from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWReproducibilityReading(Base):
    __tablename__ = "htw_reproducibility_reading"

    id = Column(Integer, primary_key=True, index=True)
    
    # Links to the specific Sequence row above
    reproducibility_id = Column(Integer, ForeignKey("htw_reproducibility.id"), nullable=False)
    
    # Reading number (1 to 5)
    reading_order = Column(Integer, nullable=False)
    
    # The actual value entered by the user
    indicated_reading = Column(Numeric(14, 4), nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=func.now())

    # Relationship back to Parent Sequence
    reproducibility = relationship("HTWReproducibility", back_populates="readings")