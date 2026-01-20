from sqlalchemy import Column, Integer, String, Numeric, Date, TIMESTAMP, func
from backend.db import Base


class HTWJobStandardSnapshot(Base):
    __tablename__ = "htw_job_standard_snapshot"

    id = Column(Integer, primary_key=True)

    job_id = Column(Integer, nullable=False)
    master_standard_id = Column(Integer, nullable=False)

    standard_order = Column(Integer, nullable=False)

    nomenclature = Column(String, nullable=False)
    manufacturer = Column(String)
    model_serial_no = Column(String)
    certificate_no = Column(String)
    traceable_to_lab = Column(String)
    calibration_valid_upto = Column(Date)

    uncertainty = Column(Numeric(18, 8))
    uncertainty_unit = Column(String)

    resolution = Column(Numeric(14, 4))
    resolution_unit = Column(String)

    accuracy_of_master = Column(Numeric(14, 4))

    captured_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
