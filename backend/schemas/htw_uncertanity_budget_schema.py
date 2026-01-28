from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# --- Request for POST Calculation ---
class UncertaintyCalculationRequest(BaseModel):
    inward_id: int
    inward_eqp_id: int

# --- Response for POST Calculation ---
class UncertaintyCalculationResponse(BaseModel):
    message: str
    job_id: int
    steps_calculated: int

# --- Response for GET Budget Detail ---
class UncertaintyBudgetDetailResponse(BaseModel):
    id: int
    job_id: int
    step_percent: float
    set_torque_ts: float

    # Individual components
    delta_s_un: Optional[float] = None
    delta_p: Optional[float] = None
    wmd: Optional[float] = None
    wr: Optional[float] = None
    wrep: Optional[float] = None
    wod: Optional[float] = None
    wint: Optional[float] = None
    wl: Optional[float] = None
    wre: Optional[float] = None

    # Final results
    combined_uncertainty: Optional[float] = None
    effective_dof: Optional[float] = None
    coverage_factor: Optional[float] = None
    expanded_uncertainty: Optional[float] = None
    expanded_un_nm: Optional[float] = None

    # Error comparison & decision values
    mean_measurement_error: Optional[float] = None
    max_device_error: Optional[float] = None
    final_wl: Optional[float] = None
    cmc: Optional[float] = None
    cmc_of_reading: Optional[float] = None

    created_at: datetime

    class Config:
        from_attributes = True  # Allows Pydantic to read from SQLAlchemy models