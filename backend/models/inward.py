from datetime import date
from typing import List, TYPE_CHECKING
from sqlalchemy import (
    Column, Integer, String, Date, TIMESTAMP, 
    ForeignKey, func, Boolean
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship, Mapped

from backend.db import Base

if TYPE_CHECKING:
    from .users import User
    from .customers import Customer
    from .inward_equipments import InwardEquipment
    from .srfs import Srf
    from .notifications import Notification
    from .delayed_email_tasks import DelayedEmailTask
    # ✅ ADDED: Import HTWJob for type checking
    from .htw_job import HTWJob 


class Inward(Base):
    __tablename__ = "inward"

    inward_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="SET NULL"))
    
    srf_no = Column(String(100), nullable=False, unique=True, index=True)
    
    material_inward_date = Column(Date, nullable=False)
    customer_dc_no = Column(String(255))
    customer_dc_date = Column(String(255))
    customer_details = Column(String(255))
    received_by = Column(String)
    
    created_by = Column(Integer, ForeignKey("users.user_id"))
    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True))
    status = Column(String(50), default='created')
    
    draft_data = Column(JSONB, nullable=True)
    is_draft = Column(Boolean, default=False)
    draft_updated_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # --- Relationships ---
    
    customer: Mapped["Customer"] = relationship("Customer")
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    updater: Mapped["User"] = relationship("User", foreign_keys=[updated_by])
    
    equipments: Mapped[List["InwardEquipment"]] = relationship("InwardEquipment", back_populates="inward", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="inward", cascade="all, delete-orphan")
    delayed_tasks: Mapped[List["DelayedEmailTask"]] = relationship("DelayedEmailTask", back_populates="inward", cascade="all, delete-orphan")
    
    srf: Mapped["Srf"] = relationship("Srf", back_populates="inward", uselist=False, cascade="all, delete-orphan")

    # ✅ ADDED: Relationship to HTWJob
    # This matches 'inward_rel' defined in htw_job.py
    jobs: Mapped[List["HTWJob"]] = relationship("HTWJob", back_populates="inward_rel")