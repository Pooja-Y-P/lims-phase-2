from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey,
    CheckConstraint, UniqueConstraint, DateTime, func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWOutputDriveVariation(Base):
    __tablename__ = "htw_output_drive_variation"

    id = Column(Integer, primary_key=True)

    job_id = Column(
        Integer,
        ForeignKey("htw_job.job_id", ondelete="CASCADE"),
        nullable=False
    )

    set_torque_ts = Column(Numeric(14, 4), nullable=False)
    position_deg = Column(Integer, nullable=False)
    mean_value = Column(Numeric(18, 8))
    error_due_output_drive_bout = Column(Numeric(18, 8))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    readings = relationship(
        "HTWOutputDriveVariationReading",
        back_populates="variation",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "position_deg IN (0, 90, 180, 270)",
            name="chk_output_drive_position_deg"
        ),
        UniqueConstraint(
            "job_id", "position_deg",
            name="uq_output_drive_job_position"
        ),
    )
