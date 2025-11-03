from datetime import date
from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func, Boolean, JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Mapped
from typing import List, TYPE_CHECKING
from backend.db import Base

if TYPE_CHECKING:
    from .users import User
    from .customers import Customer
    from .inward_equipments import InwardEquipment
    from .srfs import Srf
    from .notifications import Notification
    from .delayed_email_tasks import DelayedEmailTask


class Inward(Base):
    __tablename__ = "inward"

    inward_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="SET NULL"), index=True, nullable=True)
    srf_no = Column(String, unique=True, nullable=False, index=True)
    date = Column(Date, nullable=False)
    customer_dc_date = Column(String(255))
    customer_details = Column(String(255))
    
    received_by = Column(Integer, ForeignKey("users.user_id"), index=True)
    created_by = Column(Integer, ForeignKey("users.user_id"))
    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True))
    status = Column(String(50), default='created')

    # 🆕 Added columns
    draft_data = Column(JSONB, nullable=True, default=None)
    is_draft = Column(Boolean, default=False)
    draft_updated_at = Column(TIMESTAMP(timezone=True), nullable=True, default=None)

    # Relationships
    customer: Mapped["Customer"] = relationship("Customer")
    receiver: Mapped["User"] = relationship("User", foreign_keys=[received_by], back_populates="inwards_received")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by], back_populates="inwards_created")
    updater: Mapped["User"] = relationship("User", foreign_keys=[updated_by], back_populates="inwards_updated")
    
    equipments: Mapped[List["InwardEquipment"]] = relationship("InwardEquipment", back_populates="inward", cascade="all, delete-orphan")
    srf: Mapped["Srf"] = relationship("Srf", back_populates="inward", uselist=False, cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="inward", cascade="all, delete-orphan")
    delayed_tasks: Mapped[List["DelayedEmailTask"]] = relationship("DelayedEmailTask", back_populates="inward", cascade="all, delete-orphan")
