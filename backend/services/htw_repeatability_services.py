from sqlalchemy.orm import Session
from sqlalchemy import and_
from backend.models import (
    HTWJob, 
    InwardEquipment, 
    HTWManufacturerSpec, 
    HTWCorrectedStandardReference, 
    HTWRepeatability, 
    HTWRepeatabilityReading
)
from backend.schemas.htw_repeatability_schemas import (
    RepeatabilityCalculationRequest, 
    RepeatabilityResponse
)
from datetime import datetime

# --- HELPER FUNCTIONS ---

def get_job_and_specs(db: Session, job_id: int):
    """
    Fetches Job, Equipment, and Manufacturer Specs.
    """
    job = db.query(HTWJob).filter(HTWJob.job_id == job_id).first()
    if not job:
        raise ValueError(f"Job ID {job_id} not found")

    eqp = db.query(InwardEquipment).filter(InwardEquipment.inward_eqp_id == job.inward_eqp_id).first()
    if not eqp:
        raise ValueError("Equipment details not found for this job")

    specs = db.query(HTWManufacturerSpec).filter(
        and_(HTWManufacturerSpec.make == eqp.make, HTWManufacturerSpec.model == eqp.model)
    ).first()
    
    if not specs:
        raise ValueError(f"Manufacturer specifications not found for Make: {eqp.make}, Model: {eqp.model}")
        
    return job, specs

def get_set_values(specs: HTWManufacturerSpec, step_percent: float):
    """
    Auto-populates Set Pressure (Ps) and Set Torque (Ts) for 20, 60, 100 steps.
    """
    percent = int(step_percent)
    
    if percent == 20:
        return specs.pressure_20, specs.torque_20
    elif percent == 60:
        return specs.pressure_60, specs.torque_60
    elif percent == 100:
        return specs.pressure_100, specs.torque_100
    else:
        raise ValueError(f"Step {percent}% is not supported. Only 20, 60, and 100 are allowed.")

def calculate_interpolation(db: Session, mean_xr: float) -> float:
    """
    FR-15: Calculates Interpolated Error using htw_corrected_standard_reference table.
    Logic: Linear Interpolation -> Absolute Value -> Round to 2 decimals.
    """
    # Find the range where the Mean Xr falls
    ref = db.query(HTWCorrectedStandardReference).filter(
        and_(
            HTWCorrectedStandardReference.lower_range <= mean_xr,
            HTWCorrectedStandardReference.higher_range >= mean_xr,
            HTWCorrectedStandardReference.is_active == True
        )
    ).first()

    if not ref:
        return 0.0 

    # Variables for Linear Interpolation
    x = float(mean_xr)
    x1 = float(ref.lower_range)
    x2 = float(ref.higher_range)
    y1 = float(ref.lower_error)
    y2 = float(ref.higher_error)

    # Avoid division by zero
    if (x2 - x1) == 0:
        raw_y = y1
    else:
        # Linear Interpolation Formula
        raw_y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))
    
    # 1. Take Absolute Value
    abs_y = abs(raw_y)
    
    # 2. Round to 2 decimal places
    final_y = round(abs_y, 2)
    
    return final_y

# --- MAIN SERVICE FUNCTION ---

def process_repeatability_calculation(db: Session, request: RepeatabilityCalculationRequest):
    """
    Main logic to calculate Mean, Interpolation, Deviation.
    """
    
    job, specs = get_job_and_specs(db, request.job_id)
    results_summary = []

    for step_data in request.steps:
        
        # A. Fetch Set Values
        ps, ts = get_set_values(specs, step_data.step_percent)
        
        if ts is None:
            raise ValueError(f"Set Torque (Ts) is missing in Manufacturer Specs for {step_data.step_percent}%")

        # B. Calculate Mean (Xr)
        readings = step_data.readings
        mean_xr = sum(readings) / len(readings)

        # C. Calculate Corrected Standard (Interpolation) - Absolute & Rounded (2 decimals)
        corrected_standard = calculate_interpolation(db, mean_xr)

        # D. Calculate Corrected Mean
        # Formula: Corrected Mean = Mean - Corrected Standard
        corrected_mean = mean_xr - corrected_standard

        # E. Calculate Deviation Percentage
        # Formula: Deviation = [(Corrected Mean – Set Torque) * 100] / (Set Torque)
        ts_float = float(ts)
        
        if ts_float != 0:
            raw_deviation = ((corrected_mean - ts_float) * 100) / ts_float
            # --- UPDATED: Round Deviation to 2 decimal places ---
            deviation_percent = round(raw_deviation, 2)
        else:
            deviation_percent = 0.0

        # --- DB OPERATIONS ---

        # F. Delete existing record (to allow re-calculation)
        db.query(HTWRepeatability).filter(
            and_(
                HTWRepeatability.job_id == request.job_id,
                HTWRepeatability.step_percent == step_data.step_percent
            )
        ).delete(synchronize_session=False)
        
        db.flush()

        # G. Insert Header
        header = HTWRepeatability(
            job_id=request.job_id,
            step_percent=step_data.step_percent,
            set_pressure_ps=ps,
            set_torque_ts=ts,
            mean_xr=mean_xr,
            corrected_standard=corrected_standard,
            corrected_mean=corrected_mean,
            deviation_percent=deviation_percent, # Storing the rounded value
            created_at=datetime.now()
        )
        db.add(header)
        db.flush() 

        # H. Insert Readings
        reading_rows = []
        for i, val in enumerate(readings, start=1):
            reading_rows.append(HTWRepeatabilityReading(
                repeatability_id=header.id,
                reading_order=i,
                indicated_reading=val
            ))
        
        db.add_all(reading_rows)
        
        # I. Add result to response summary
        results_summary.append({
            "step_percent": step_data.step_percent,
            "mean_xr": round(mean_xr, 4),
            "set_pressure": float(ps),
            "set_torque": float(ts),
            "corrected_standard": corrected_standard, 
            "corrected_mean": round(corrected_mean, 4),
            "deviation_percent": deviation_percent # Returning the rounded value
        })

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "results": results_summary
    }