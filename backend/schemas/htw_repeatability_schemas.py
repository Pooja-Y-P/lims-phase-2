from pydantic import BaseModel, Field, field_validator, conlist
from typing import List, Optional

# ==============================================================================
#                            A. REPEATABILITY SCHEMAS
# ==============================================================================

class RepeatabilityStepInput(BaseModel):
    step_percent: float = Field(..., description="Must be 20, 60, or 100")
    readings: conlist(float, min_length=5, max_length=5) = Field(
        ..., description="List of exactly 5 indicated readings (S1 to S5)"
    )

    @field_validator("step_percent")
    def validate_step(cls, v: float) -> float:
        allowed = [20.0, 60.0, 100.0]
        if v not in allowed:
            raise ValueError(f"Step percent must be one of {allowed}")
        return v

class RepeatabilityCalculationRequest(BaseModel):
    job_id: int
    steps: List[RepeatabilityStepInput]

class CalculationResultResponse(BaseModel):
    step_percent: float
    mean_xr: float
    set_pressure: float
    set_torque: float
    corrected_standard: float
    corrected_mean: float
    deviation_percent: float
    pressure_unit: str 
    torque_unit: str
    stored_readings: Optional[List[float]] = None 

class RepeatabilityResponse(BaseModel):
    job_id: int
    status: str
    results: List[CalculationResultResponse]


# ==============================================================================
#                           B. REPRODUCIBILITY SCHEMAS
# ==============================================================================

class ReproducibilitySequenceInput(BaseModel):
    sequence_no: int = Field(..., ge=1, le=4, description="Sequence Number (1=I, 2=II, 3=III, 4=IV)")
    readings: conlist(float, min_length=5, max_length=5) = Field(
        ..., description="List of exactly 5 indicated readings"
    )

class ReproducibilityCalculationRequest(BaseModel):
    job_id: int
    sequences: List[ReproducibilitySequenceInput]

class SequenceResultResponse(BaseModel):
    sequence_no: int
    readings: List[float]
    mean_xr: float

class ReproducibilityResponse(BaseModel):
    job_id: int
    status: str
    set_torque_20: float
    error_due_to_reproducibility: float  # b_rep
    torque_unit: Optional[str] = None    # Added to support unit display in frontend
    sequences: List[SequenceResultResponse]