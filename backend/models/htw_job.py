from sqlalchemy import (
    Column, Integer, Numeric, Text, Date, TIMESTAMP, 
    ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from backend.db import Base

class HTWJob(Base):
    __tablename__ = "htw_job"

    # Define Unique Constraints matching your SQL exactly
    __table_args__ = (
        UniqueConstraint("inward_eqp_id", name="htw_job_inward_eqp_id_key"),
        UniqueConstraint("inward_id", name="htw_job_inward_id_key"),
    )

    job_id = Column(Integer, primary_key=True, autoincrement=True)

    # --- FOREIGN KEYS ---
    # Note: We do NOT use "public." prefix here. SQLAlchemy maps to Table Names.
    
    # 1. Links to 'inward' table
    inward_id = Column(Integer, ForeignKey("inward.inward_id"), nullable=True)

    # 2. Links to 'inward_equipments' table
    inward_eqp_id = Column(Integer, ForeignKey("inward_equipments.inward_eqp_id"), nullable=True)

    # 3. Links to 'srfs' table
    srf_id = Column(Integer, ForeignKey("srfs.srf_id"), nullable=True)

    # 4. Links to 'srf_equipments' table
    srf_eqp_id = Column(Integer, ForeignKey("srf_equipments.srf_eqp_id"), nullable=True)

    # 5. Links to 'htw_pressure_gauge_resolution' table
    pressure_gauge_ref_id = Column(Integer, ForeignKey("htw_pressure_gauge_resolution.id"), nullable=True)

    # --- DATA COLUMNS ---
    res_pressure = Column(Numeric(14, 4))
    range_min = Column(Numeric(14, 4))
    range_max = Column(Numeric(14, 4))
    date = Column(Date)
    
    # Default values as per SQL 'server_default'
    type = Column(Text, server_default="indicating")
    classification = Column(Text, server_default="Type I Class C")
    job_status = Column(Text)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # --- RELATIONSHIPS ---
    # These strings must match your Python CLASS names in other files.
    # Assuming your classes are named: Inward, InwardEquipment, Srf, SrfEquipment
    
    inward_rel = relationship("Inward", back_populates="jobs")
    
    equipment_rel = relationship("InwardEquipment", back_populates="jobs")
    
    # Optional relationships for SRF if you have those models defined
    # srf_rel = relationship("Srf", backref="jobs")
    # srf_eqp_rel = relationship("SrfEquipment", backref="jobs")
    
    # Link to Repeatability
    repeatability = relationship("HTWRepeatability", back_populates="job_rel")
    environments = relationship(
        "HTWJobEnvironment", 
        back_populates="job", 
        cascade="all, delete-orphan"
    )