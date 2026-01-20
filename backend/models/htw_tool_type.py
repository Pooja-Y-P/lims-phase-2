from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    TIMESTAMP,
    CheckConstraint,
    func
)
from backend.db import Base
 
 
class HTWToolType(Base):
    __tablename__ = "htw_tool_type"
 
    id = Column(Integer, primary_key=True, index=True)
 
    tool_name = Column(String, nullable=False)
    tool_category = Column(String, nullable=False)
 
    operation_type = Column(
        String,
        nullable=False
    )
 
    classification = Column(String)
 
    is_active = Column(Boolean, default=True)
 
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())
 
    __table_args__ = (
        CheckConstraint(
            "operation_type IN ('Indicating', 'Setting')",
            name="chk_tool_operation_type"
        ),
    )