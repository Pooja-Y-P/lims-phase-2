from sqlalchemy import (
    Column, Integer, Numeric, TIMESTAMP,
    ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from backend.db import Base

class HTWReproducibility(Base):
    __tablename__ = "htw_reproducibility"
    __table_args__ = (
        UniqueConstraint(
            "job_id",
            "sequence_no",
            name="htw_reproducibility_job_id_sequence_no_key"
        ),
        {"schema": "public"}
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    job_id = Column(
        Integer,
        ForeignKey("public.htw_job.job_id", ondelete="CASCADE"),
        nullable=False
    )

    set_torque_ts = Column(Numeric(14, 4), nullable=False)
    sequence_no = Column(Integer, nullable=False)

    mean_xr = Column(Numeric(18, 8))
    error_due_to_reproducibility = Column(Numeric(18, 8))

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )

    # 🔗 Relationships
    job = relationship("HTWJob", back_populates="reproducibility")
    readings = relationship(
        "HTWReproducibilityReading",
        back_populates="reproducibility",
        cascade="all, delete-orphan"
    )

    