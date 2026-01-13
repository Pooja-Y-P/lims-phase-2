from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc
from backend.models import (
    HTWJob, 
    InwardEquipment, 
    HTWManufacturerSpec, 
    HTWStandardUncertaintyReference, 
    HTWRepeatability, 
    HTWRepeatabilityReading
)
from backend.schemas.htw_repeatability_schemas import (
    RepeatabilityCalculationRequest
)
from datetime import datetime



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
    FR-15: Calculates Interpolated Error using htw_standard_uncertainty_reference.
    """
    val = float(mean_xr)

    # 1. Find Lower Neighbor (x1)
    lower_ref = db.query(HTWStandardUncertaintyReference).filter(
        and_(
            HTWStandardUncertaintyReference.indicated_torque <= val,
            HTWStandardUncertaintyReference.is_active == True
        )
    ).order_by(desc(HTWStandardUncertaintyReference.indicated_torque)).first()

    # 2. Find Higher Neighbor (x2)
    upper_ref = db.query(HTWStandardUncertaintyReference).filter(
        and_(
            HTWStandardUncertaintyReference.indicated_torque >= val,
            HTWStandardUncertaintyReference.is_active == True
        )
    ).order_by(asc(HTWStandardUncertaintyReference.indicated_torque)).first()

    # --- Scenario Handling ---
    if not lower_ref and not upper_ref:
        return 0.0

    if not lower_ref and upper_ref:
        return abs(float(upper_ref.error_value))

    if lower_ref and not upper_ref:
        return abs(float(lower_ref.error_value))

    if lower_ref.id == upper_ref.id:
        return abs(float(lower_ref.error_value))

    x = val
    x1 = float(lower_ref.indicated_torque)
    y1 = float(lower_ref.error_value)
    
    x2 = float(upper_ref.indicated_torque)
    y2 = float(upper_ref.error_value)

    if (x2 - x1) == 0:
        raw_y = y1
    else:
        raw_y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))

    abs_y = abs(raw_y)
    return round(abs_y, 2)

# --- MAIN SERVICE FUNCTION (CALCULATE) ---

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

        # C. Calculate Corrected Standard (Interpolation)
        corrected_standard = calculate_interpolation(db, mean_xr)

        # D. Calculate Corrected Mean
        corrected_mean = mean_xr - corrected_standard

        # E. Calculate Deviation Percentage
        ts_float = float(ts)
        
        if ts_float != 0:
            raw_deviation = ((corrected_mean - ts_float) * 100) / ts_float
            deviation_percent = round(raw_deviation, 2)
        else:
            deviation_percent = 0.0

        # --- DB OPERATIONS ---

        # F. Delete existing record
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
            deviation_percent=deviation_percent,
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
            "deviation_percent": deviation_percent
        })

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "results": results_summary
    }

# --- NEW FUNCTION TO FETCH STORED DATA ---

def get_stored_repeatability(db: Session, job_id: int):
    """
    Fetches existing repeatability data (Headers + Readings) for a job.
    
    UPDATED: If no calculations exist, it fetches Manufacturer Specs
    and returns Set Pressure/Torque values for 20, 60, 100 steps
    so the frontend can populate the table before user input.
    """
    # 1. Fetch all step headers for this job (Existing Calculation)
    steps_db = db.query(HTWRepeatability).filter(
        HTWRepeatability.job_id == job_id
    ).order_by(asc(HTWRepeatability.step_percent)).all()

    results_summary = []

    if steps_db:
        # CASE A: Data exists in DB (Previously calculated)
        for step_row in steps_db:
            readings_db = db.query(HTWRepeatabilityReading).filter(
                HTWRepeatabilityReading.repeatability_id == step_row.id
            ).order_by(HTWRepeatabilityReading.reading_order).all()

            reading_values = [float(r.indicated_reading) for r in readings_db]

            results_summary.append({
                "step_percent": float(step_row.step_percent),
                "mean_xr": float(step_row.mean_xr) if step_row.mean_xr is not None else 0.0,
                "set_pressure": float(step_row.set_pressure_ps) if step_row.set_pressure_ps is not None else 0.0,
                "set_torque": float(step_row.set_torque_ts) if step_row.set_torque_ts is not None else 0.0,
                "corrected_standard": float(step_row.corrected_standard) if step_row.corrected_standard is not None else 0.0,
                "corrected_mean": float(step_row.corrected_mean) if step_row.corrected_mean is not None else 0.0,
                "deviation_percent": float(step_row.deviation_percent) if step_row.deviation_percent is not None else 0.0,
                "stored_readings": reading_values
            })
    else:
        # CASE B: No Calculation Data (New Job)
        # Fetch Specs to show Set Pressure/Torque to the user immediately
        try:
            job, specs = get_job_and_specs(db, job_id)
            
            # Pre-populate 20, 60, 100 steps with Set Values from specs
            for step in [20.0, 60.0, 100.0]:
                ps, ts = get_set_values(specs, step)
                
                results_summary.append({
                    "step_percent": step,
                    "mean_xr": 0.0,
                    "set_pressure": float(ps) if ps is not None else 0.0,
                    "set_torque": float(ts) if ts is not None else 0.0,
                    "corrected_standard": 0.0,
                    "corrected_mean": 0.0,
                    "deviation_percent": 0.0,
                    "stored_readings": [] # Empty list as no readings entered yet
                })
        except ValueError:
            # If specs are missing, return empty list (frontend handles error or shows empty table)
            return {"job_id": job_id, "status": "no_specs", "results": []}

    return {
        "job_id": job_id,
        "status": "success",
        "results": results_summary
    }