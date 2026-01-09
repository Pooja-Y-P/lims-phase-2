from sqlalchemy import Column, Integer, Numeric, TIMESTAMP, ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.db import Base

class HTWRepeatability(Base):
    __tablename__ = "htw_repeatability"

    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Foreign Key to HTWJob
    # Note: "htw_job.job_id" refers to table_name.column_name
    job_id = Column(Integer, ForeignKey("htw_job.job_id", ondelete="CASCADE"), nullable=False)
    
    step_percent = Column(Numeric(5, 2), nullable=False)
    set_pressure_ps = Column(Numeric(14, 4))
    set_torque_ts = Column(Numeric(14, 4))
    
    mean_xr = Column(Numeric(18, 8))
    corrected_standard = Column(Numeric(18, 8))
    corrected_mean = Column(Numeric(18, 8))
    deviation_percent = Column(Numeric(18, 8))
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Constraints
    __table_args__ = (
        UniqueConstraint('job_id', 'step_percent', name='htw_repeatability_job_id_step_percent_key'),
    )

    # --- RELATIONSHIPS ---
    
    # 1. Back to Job
    # This MUST match relationship("HTWRepeatability", back_populates="job_rel") in HTWJob
    job_rel = relationship("HTWJob", back_populates="repeatability")

    # 2. To Readings
    readings = relationship("HTWRepeatabilityReading", back_populates="header", cascade="all, delete-orphan")