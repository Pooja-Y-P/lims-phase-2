from pydantic import BaseModel, Field, conlist, field_validator
from typing import List, Optional

# ==============================================================================
#                            A. REPEATABILITY SCHEMAS
# ==============================================================================

class RepeatabilityStepInput(BaseModel):
    # Removed rigid validator to allow 40%, 80%, etc.
    step_percent: float = Field(..., description="Step percentage (e.g., 20, 40, 60, 80, 100)")
    
    # Accept manual set values from frontend (Optional, default to 0 for drafts)
    set_pressure: Optional[float] = 0.0
    set_torque: Optional[float] = 0.0
    
    # Drafts accept 0s for empty readings
    readings: conlist(float, min_length=5, max_length=5) = Field(
        ..., description="List of exactly 5 indicated readings. Send 0.0 for empty."
    )

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
    # Allow floats, including 0.0 for empty fields
    readings: conlist(float, min_length=5, max_length=5) = Field(
        ..., description="List of exactly 5 indicated readings. Use 0.0 for empty."
    )

class ReproducibilityCalculationRequest(BaseModel):
    job_id: int
    torque_unit: Optional[str] = None
    sequences: List[ReproducibilitySequenceInput]

class SequenceResultResponse(BaseModel):
    sequence_no: int
    readings: List[float]
    mean_xr: float

class ReproducibilityResponse(BaseModel):
    job_id: int
    status: str
    set_torque_20: float
    error_due_to_reproducibility: float
    torque_unit: Optional[str] = None
    sequences: List[SequenceResultResponse]


# ==============================================================================
#                      C & D. GEOMETRIC VARIATIONS (Output & Drive)
# ==============================================================================

class GeometricVariationInput(BaseModel):
    position_deg: int = Field(..., description="Must be 0, 90, 180, or 270")
    # Drafts accept 0.0 for empty readings
    readings: conlist(float, min_length=10, max_length=10) = Field(
        ..., description="List of exactly 10 indicated readings. Use 0.0 for empty."
    )

    @field_validator("position_deg")
    def validate_position(cls, v):
        # We keep this validation because the UI rows are fixed
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
    
    # Generic error field (used for display logic)
    error_value: float
    
    # Specific DB columns (Added for clarity/storage verification)
    error_due_output_drive_bout: Optional[float] = None
    error_due_drive_interface_bint: Optional[float] = None
    
    torque_unit: Optional[str] = None
    positions: List[GeometricPositionResult]


# ==============================================================================
#                        E. LOADING POINT VARIATION
# ==============================================================================

class LoadingPointInput(BaseModel):
    loading_position_mm: int = Field(..., description="Must be -10 or 10")
    # Drafts accept 0.0 for empty readings
    readings: conlist(float, min_length=10, max_length=10) = Field(
        ..., description="List of exactly 10 indicated readings. Use 0.0 for empty."
    )

    @field_validator("loading_position_mm")
    def validate_mm(cls, v):
        # We keep this validation because the UI rows are fixed
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
    
    # Generic error field
    error_due_to_loading_point: float
    
    # Specific DB column (Added for clarity/storage verification)
    error_due_loading_point_bl: Optional[float] = None
    
    torque_unit: Optional[str] = None
    positions: List[LoadingPointResult]