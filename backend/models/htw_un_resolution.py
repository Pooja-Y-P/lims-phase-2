from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    TIMESTAMP,
    func,
)
from sqlalchemy.orm import relationship
from backend.db import Base  # adjust import if needed


class HTWUnResolution(Base):
    __tablename__ = "htw_un_resolution"

    id = Column(Integer, primary_key=True, index=True)

    job_id = Column(
        Integer,
        ForeignKey("htw_job.job_id", ondelete="CASCADE"),
        nullable=False,
    )

    # 20 / 40 / 60 / 80 / 100
    step_percent = Column(Numeric(5, 2), nullable=False)

    # Derived / calculated results only
    measurement_error = Column(Numeric(18, 8))             # Xa − Xr
    relative_measurement_error = Column(Numeric(18, 8))    # %
    a_s = Column(Numeric(18, 8))                            # āₛ
    deviation = Column(Numeric(18, 8))
    variation_due_to_repeatability = Column(Numeric(18, 8))  # bₑ (FINAL)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("job_id", "step_percent", name="uq_job_step_resolution"),
    )

    # Optional relationship (if htw_job model exists)
    job = relationship("HTWJob", back_populates="un_resolutions")
