# backend/models/delayed_email_tasks.py

from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, func, Boolean
from sqlalchemy.orm import relationship, Mapped
from typing import Optional, TYPE_CHECKING # <-- Import TYPE_CHECKING
from backend.db import Base

# --- THIS IS THE FIX ---
if TYPE_CHECKING:
    from .inward import Inward
    from .users import User

class DelayedEmailTask(Base):
    __tablename__ = "delayed_email_tasks"

    id = Column(Integer, primary_key=True)
    inward_id = Column(Integer, ForeignKey("inward.inward_id", ondelete="CASCADE"), nullable=False)
    
    recipient_email = Column(String(320), nullable=True) 
    email_type = Column(String(50), default="first_inspection_report")
    scheduled_at = Column(TIMESTAMP(timezone=True), nullable=False)
    is_sent = Column(Boolean, default=False)
    is_cancelled = Column(Boolean, default=False)
    reminder_sent = Column(Boolean, default=False)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    sent_at = Column(TIMESTAMP(timezone=True), nullable=True)
    
    # Relationships are now correctly type-hinted
    inward: Mapped["Inward"] = relationship("Inward", back_populates="delayed_tasks") 
    creator: Mapped["User"] = relationship("User", back_populates="created_delayed_tasks")