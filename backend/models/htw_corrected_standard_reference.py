from sqlalchemy import (
    Column, Integer, Numeric, Boolean, Date, TIMESTAMP, func
)
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class HTWCorrectedStandardReference(Base):
    __tablename__ = "htw_corrected_standard_reference"
    __table_args__ = {"schema": "public"}  # matches your PostgreSQL schema

    id = Column(Integer, primary_key=True, autoincrement=True)
    valid_from = Column(Date, nullable=False)
    valid_upto = Column(Date, nullable=False)
    torque_nm = Column(Integer, nullable=False)
    lower_range = Column(Numeric(14, 4), nullable=False)
    higher_range = Column(Numeric(14, 4), nullable=False)
    lower_error = Column(Numeric(18, 8), nullable=False)
    higher_error = Column(Numeric(18, 8), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
