from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey,
    CheckConstraint, UniqueConstraint, DateTime, func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWOutputDriveVariationReading(Base):
    __tablename__ = "htw_output_drive_variation_reading"

    id = Column(Integer, primary_key=True)

    output_drive_variation_id = Column(
        Integer,
        ForeignKey("htw_output_drive_variation.id", ondelete="CASCADE"),
        nullable=False
    )

    reading_order = Column(Integer, nullable=False)
    indicated_reading = Column(Numeric(14, 4), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    variation = relationship(
        "HTWOutputDriveVariation",
        back_populates="readings"
    )

    __table_args__ = (
        CheckConstraint(
            "reading_order BETWEEN 1 AND 20",
            name="chk_output_drive_reading_order"
        ),
        UniqueConstraint(
            "output_drive_variation_id", "reading_order",
            name="uq_output_drive_reading_order"
        ),
    )
