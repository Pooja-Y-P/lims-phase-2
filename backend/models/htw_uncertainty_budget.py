from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    ForeignKey,
    TIMESTAMP,
    func
)
from sqlalchemy.orm import relationship
from backend.db import Base   # ✅ USE SAME BASE

class HTWUncertaintyBudget(Base):
    __tablename__ = "htw_uncertainty_budget"

    id = Column(Integer, primary_key=True)

    job_id = Column(
        Integer,
        ForeignKey("htw_job.job_id", ondelete="CASCADE"),
        nullable=False
    )

    step_percent = Column(Numeric(5, 2), nullable=False)
    set_torque_ts = Column(Numeric(14, 4), nullable=False)

    # ---- Individual uncertainty components ----
    delta_s_un = Column(Numeric(18, 8))
    delta_p    = Column(Numeric(18, 8))
    wmd        = Column(Numeric(18, 8))
    wr         = Column(Numeric(18, 8))
    wrep       = Column(Numeric(18, 8))
    wod        = Column(Numeric(18, 8))
    wint       = Column(Numeric(18, 8))
    wl         = Column(Numeric(18, 8))
    wre        = Column(Numeric(18, 8))

    # ---- Final uncertainty results ----
    combined_uncertainty = Column(Numeric(18, 8))
    effective_dof        = Column(Numeric(18, 8))
    coverage_factor      = Column(Numeric(6, 3))
    expanded_uncertainty = Column(Numeric(18, 8))
    expanded_un_nm       = Column(Numeric(18, 8))

    # ---- Error comparison & decision values ----
    mean_measurement_error = Column(Numeric(18, 8))
    max_device_error       = Column(Numeric(18, 8))
    final_wl               = Column(Numeric(18, 8))

    cmc            = Column(Numeric(18, 8))
    cmc_of_reading = Column(Numeric(18, 8))

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )

    job = relationship("HTWJob", back_populates="uncertainty_budget")
