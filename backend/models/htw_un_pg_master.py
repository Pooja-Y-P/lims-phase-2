from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    Boolean,
    Date,
    TIMESTAMP,
    func,
    UniqueConstraint
)
from backend.db import Base
 
 
class HTWUnPGMaster(Base):
    __tablename__ = "htw_un_pg_master"
 
    __table_args__ = (
        UniqueConstraint(
            "set_pressure_min",
            "set_pressure_max",
            name="uq_un_pg_pressure_range"
        ),
    )
 
    id = Column(Integer, primary_key=True, index=True)
 
    set_pressure_min = Column(Numeric(14, 4), nullable=False)
    set_pressure_max = Column(Numeric(14, 4), nullable=False)
 
    uncertainty_percent = Column(Numeric(8, 4), nullable=False)
 
    valid_upto = Column(Date, nullable=False)
 
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
 
 