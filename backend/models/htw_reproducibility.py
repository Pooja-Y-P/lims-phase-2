from sqlalchemy import Column, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.db import Base

class HTWReproducibility(Base):
    __tablename__ = "htw_reproducibility"

    id = Column(Integer, primary_key=True, index=True)
    
    # Links to the Job Table
    job_id = Column(Integer, ForeignKey("htw_job.job_id"), nullable=False)
    
    # The Set Torque value (automatically fetched from 20% spec)
    set_torque_ts = Column(Numeric(14, 4), nullable=False)
    
    # Sequence Number (1=I, 2=II, 3=III, 4=IV)
    sequence_no = Column(Integer, nullable=False)
    
    # Calculated Mean for this specific sequence
    mean_xr = Column(Numeric(18, 8))
    
    # The final calculation result (b_rep = Max Mean - Min Mean)
    error_due_to_reproducibility = Column(Numeric(18, 8))
    
    created_at = Column(DateTime(timezone=True), default=func.now())

    # Relationship to Child Readings
    readings = relationship(
        "HTWReproducibilityReading", 
        back_populates="reproducibility", 
        cascade="all, delete-orphan"
    )

