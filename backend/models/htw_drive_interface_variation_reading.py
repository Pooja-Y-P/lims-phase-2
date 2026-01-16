from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey,
    CheckConstraint, UniqueConstraint, DateTime, func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWDriveInterfaceVariationReading(Base):
    __tablename__ = "htw_drive_interface_variation_reading"

    id = Column(Integer, primary_key=True)

    drive_interface_variation_id = Column(
        Integer,
        ForeignKey("htw_drive_interface_variation.id", ondelete="CASCADE"),
        nullable=False
    )

    reading_order = Column(Integer, nullable=False)
    indicated_reading = Column(Numeric(14, 4), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    variation = relationship(
        "HTWDriveInterfaceVariation",
        back_populates="readings"
    )

    __table_args__ = (
        CheckConstraint(
            "reading_order BETWEEN 1 AND 20",
            name="chk_drive_interface_reading_order"
        ),
        UniqueConstraint(
            "drive_interface_variation_id", "reading_order",
            name="uq_drive_interface_reading_order"
        ),
    )
