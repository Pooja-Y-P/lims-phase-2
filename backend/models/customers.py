# backend/models/customer.py

from sqlalchemy import Column, Integer, Text, String, Boolean, TIMESTAMP, func
from sqlalchemy.orm import relationship

from backend.db import Base

class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(Integer, primary_key=True)
    customer_details = Column(Text, nullable=False)
    contact_person = Column(String(255))
    phone = Column(String(50))
    email = Column(String(320))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True))
    is_active = Column(Boolean, default=True)

    # --- Relationships ---
    # One-to-Many: A customer can have multiple users associated with it.
    # CORRECTED: Changed back_populates from "company" to "customer" to match the User model.
    users = relationship("User", back_populates="customer")
    
    # One-to-Many: A customer can be linked in multiple invitations.
    invitations = relationship("Invitation", back_populates="customer")