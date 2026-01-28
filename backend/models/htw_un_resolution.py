from sqlalchemy import Column, Integer, Numeric, Boolean, ForeignKey, String, Date, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from backend.db import Base

# ... existing imports ...

class HTWUnResolution(Base):
    __tablename__ = "htw_un_resolution"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("htw_job.job_id", ondelete="CASCADE"), nullable=False)
    step_percent = Column(Numeric(5, 2), nullable=False)
    
    # JSONB columns for lists of values
    measurement_error = Column(JSONB, nullable=False)
    relative_measurement_error = Column(JSONB, nullable=False)
    deviation = Column(JSONB, nullable=False)
    
    # Calculated aggregates
    a_s = Column(Numeric(18, 8)) # Average of Relative Measurement Error
    variation_due_to_repeatability = Column(Numeric(18, 8)) # Standard Deviation
    
    created_at = Column(Date, default="now()")

    # Relationship
    job = relationship("HTWJob", back_populates="un_resolutions")

# Ensure you add this relationship to your existing HTWJob model:
# un_resolutions = relationship("HTWUnResolution", back_populates="job", cascade="all, delete-orphan")