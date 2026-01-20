from sqlalchemy import (
    Column, Integer, Numeric, ForeignKey,
    CheckConstraint, UniqueConstraint, DateTime, func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWLoadingPointVariation(Base):
    __tablename__ = "htw_loading_point_variation"

    id = Column(Integer, primary_key=True)

    job_id = Column(
        Integer,
        ForeignKey("htw_job.job_id", ondelete="CASCADE"),
        nullable=False
    )

    set_torque_ts = Column(Numeric(14, 4), nullable=False)
    loading_position_mm = Column(Integer, nullable=False)
    mean_value = Column(Numeric(18, 8))
    error_due_loading_point_bl = Column(Numeric(18, 8))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    readings = relationship(
        "HTWLoadingPointVariationReading",
        back_populates="variation",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "loading_position_mm IN (-10, 10)",
            name="chk_loading_position_mm"
        ),
        UniqueConstraint(
            "job_id", "loading_position_mm",
            name="uq_loading_point_job_position"
        ),
    )
