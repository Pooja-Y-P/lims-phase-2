# backend/models/invitation.py

from sqlalchemy import Column, BigInteger, Text, TIMESTAMP, ForeignKey, func, text, Integer
from sqlalchemy.orm import relationship

from backend.db import Base

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(BigInteger, primary_key=True)
    email = Column(Text, nullable=False)
    token = Column(Text, unique=True, nullable=False, server_default=text("gen_random_uuid()"))
    user_role = Column(Text, default="customer", nullable=False)
    invited_name = Column(Text)
    expires_at = Column(TIMESTAMP(timezone=True), server_default=text("(NOW() + INTERVAL '48 hours')"), nullable=False)
    used_at = Column(TIMESTAMP(timezone=True))
    created_by = Column(Integer, ForeignKey("users.user_id"))
    updated_at = Column(TIMESTAMP(timezone=True))
    customer_id = Column(Integer, ForeignKey("customers.customer_id"))
    temp_password_hash = Column(Text)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # --- Relationships ---
    creator = relationship("User", back_populates="invitations_created", foreign_keys=[created_by])
    customer = relationship("Customer", back_populates="invitations")