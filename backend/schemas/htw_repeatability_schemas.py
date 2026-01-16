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


# ... (Previous Repeatability A and Reproducibility B schemas remain unchanged) ...

# ==============================================================================
#                      C & D. GEOMETRIC VARIATIONS (Output & Drive)
# ==============================================================================

class GeometricVariationInput(BaseModel):
    position_deg: int = Field(..., description="Must be 0, 90, 180, or 270")
    readings: conlist(float, min_length=10, max_length=10) = Field(
        ..., description="List of exactly 10 indicated readings"
    )

    @field_validator("position_deg")
    def validate_position(cls, v):
        if v not in [0, 90, 180, 270]:
            raise ValueError("Position must be 0, 90, 180, or 270 degrees")
        return v

class GeometricCalculationRequest(BaseModel):
    job_id: int
    positions: List[GeometricVariationInput]

class GeometricPositionResult(BaseModel):
    position_deg: int
    readings: List[float]
    mean_value: float

class GeometricVariationResponse(BaseModel):
    job_id: int
    status: str
    set_torque: float
    error_value: float  # b_out or b_int
    torque_unit: Optional[str] = None
    positions: List[GeometricPositionResult]

# ==============================================================================
#                        E. LOADING POINT VARIATION
# ==============================================================================

class LoadingPointInput(BaseModel):
    loading_position_mm: int = Field(..., description="Must be -10 or 10")
    readings: conlist(float, min_length=10, max_length=10) = Field(
        ..., description="List of exactly 10 indicated readings"
    )

    @field_validator("loading_position_mm")
    def validate_mm(cls, v):
        if v not in [-10, 10]:
            raise ValueError("Loading position must be -10 or 10")
        return v

class LoadingPointRequest(BaseModel):
    job_id: int
    positions: List[LoadingPointInput]

class LoadingPointResult(BaseModel):
    loading_position_mm: int
    readings: List[float]
    mean_value: float

class LoadingPointResponse(BaseModel):
    job_id: int
    status: str
    set_torque: float
    error_due_to_loading_point: float  # b_l
    torque_unit: Optional[str] = None
    positions: List[LoadingPointResult]