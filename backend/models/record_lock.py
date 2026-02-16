from sqlalchemy import Column, Integer, String, DateTime, Boolean, Index
from sqlalchemy.sql import func
from backend.db import Base
import datetime

class RecordLock(Base):
    __tablename__ = "record_locks"

    id = Column(Integer, primary_key=True, index=True)
    
    # Matches SQL: entity_type character varying(50) NOT NULL
    entity_type = Column(String(50), nullable=False)
    
    # Matches SQL: entity_id integer NOT NULL
    entity_id = Column(Integer, nullable=False)
    
    # Matches SQL: locked_by_user_id integer NOT NULL
    locked_by_user_id = Column(Integer, nullable=False)
    
    # Matches SQL: locked_by_role character varying(20) NOT NULL
    locked_by_role = Column(String(20), nullable=False)

    # Matches SQL: customer_id integer
    customer_id = Column(Integer, nullable=True)

    locked_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    # Constraints
    __table_args__ = (
        Index('idx_active_lock_lookup', 'entity_type', 'entity_id', 'is_active'),
    )