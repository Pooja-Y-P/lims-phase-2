from sqlalchemy import Column, Integer, String, Date, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
from backend.db import Base

class Inward(Base):
    __tablename__ = "inward"

    inward_id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.customer_id", ondelete="SET NULL"), index=True)
    srf_no = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False)
    customer_dc_date = Column(String(255))
    customer_details = Column(String(255))
    received_by = Column(Integer, ForeignKey("users.user_id"), index=True)
    created_by = Column(Integer, ForeignKey("users.user_id"))
    # Corrected to be nullable
    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True))
    status = Column(String(50), default='created')

    customer = relationship("Customer")
    receiver = relationship("User", foreign_keys=[received_by], back_populates="inwards_received")
    creator = relationship("User", foreign_keys=[created_by], back_populates="inwards_created")
    updater = relationship("User", foreign_keys=[updated_by], back_populates="inwards_updated")
    equipments = relationship("InwardEquipment", back_populates="inward", cascade="all, delete-orphan")
    srf = relationship("Srf", back_populates="inward", uselist=False, cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="inward", cascade="all, delete-orphan")