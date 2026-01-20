from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    Boolean,
    TIMESTAMP,
    UniqueConstraint,
    func
)
from backend.db import Base
 
 
class HTWTDistribution(Base):
    __tablename__ = "htw_t_distribution"
 
    id = Column(Integer, primary_key=True, index=True)
 
    degrees_of_freedom = Column(Integer, nullable=False)
    confidence_level = Column(Numeric(6, 3), nullable=False)
    alpha = Column(Numeric(8, 5), nullable=False)
    t_value = Column(Numeric(10, 4), nullable=False)
 
    is_active = Column(Boolean, default=True)
 
    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=func.now()
    )
 
    __table_args__ = (
        UniqueConstraint(
            "degrees_of_freedom",
            "confidence_level",
            name="uq_t_dist_df_confidence"
        ),
    )
 
 