from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    Date,
    Text,
    TIMESTAMP,
    ForeignKey,
    func
)
from sqlalchemy.orm import relationship
 
from backend.db import Base
 
 
class HTWJob(Base):
    __tablename__ = "htw_job"
 
    # -------------------------
    # Primary Key
    # -------------------------
    job_id = Column(Integer, primary_key=True, index=True)
 
    # -------------------------
    # Foreign Keys / References
    # -------------------------
    inward_id = Column(Integer, ForeignKey("inward.inward_id"), nullable=True)
 
    inward_eqp_id = Column(
        Integer,
        ForeignKey("inward_equipments.inward_eqp_id"),
        nullable=True,
        unique=True
    )
 
    srf_id = Column(Integer, nullable=True)
    srf_eqp_id = Column(Integer, nullable=True)
 
    pressure_gauge_ref_id = Column(Integer, nullable=True)
 
    # -------------------------
    # Job Measurement Details
    # -------------------------
    res_pressure = Column(Numeric(14, 4), nullable=True)
 
    range_min = Column(Numeric(14, 4), nullable=True)
    range_max = Column(Numeric(14, 4), nullable=True)
 
    date = Column(Date, nullable=True)
 
    # -------------------------
    # Job Metadata
    # -------------------------
    type = Column(
        Text,
        default="indicating"
    )
 
    classification = Column(
        Text,
        default="Type I Class C"
    )
 
    job_status = Column(Text, nullable=True)
 
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
 
    # -------------------------
    # Relationships (optional but recommended)
    # -------------------------
    inward_equipment = relationship(
        "InwardEquipment",
        backref="job",
        lazy="joined"
    )