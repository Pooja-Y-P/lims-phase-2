# backend/models/notification.py

from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship

from backend.db import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    recipient_user_id = Column(Integer, ForeignKey("users.user_id"))
    to_email = Column(String(255))
    inward_id = Column(Integer, ForeignKey("inward.inward_id"))
    subject = Column(Text)
    body_text = Column(Text)
    email_sent_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(String(255))
    status = Column(String(30), default="pending")
    error = Column(Text)

    # --- Relationships ---
    recipient = relationship("User", back_populates="notifications")
    inward = relationship("Inward", back_populates="notifications")