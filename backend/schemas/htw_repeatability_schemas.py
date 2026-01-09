from pydantic import BaseModel, Field, field_validator, conlist
from typing import List

class RepeatabilityStepInput(BaseModel):
    step_percent: float = Field(..., description="Must be 20, 60, or 100")
    readings: conlist(float, min_length=5, max_length=5) = Field(
        ..., description="List of exactly 5 indicated readings (S1 to S5)"
    )

    # Pydantic V2 validator
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

class RepeatabilityResponse(BaseModel):
    job_id: int
    status: str
    results: List[CalculationResultResponse]

    