from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, asc
from datetime import datetime

# --- MODELS ---
from backend.models import (
    HTWJob, 
    InwardEquipment, 
    HTWManufacturerSpec, 
    HTWStandardUncertaintyReference, 
    HTWRepeatability, 
    HTWRepeatabilityReading,
    HTWReproducibility, 
    HTWReproducibilityReading
)

# --- SCHEMAS ---
from backend.schemas.htw_repeatability_schemas import RepeatabilityCalculationRequest, ReproducibilityCalculationRequest


# ==================================================================================
#                                SHARED HELPERS
# ==================================================================================

def get_job_and_specs(db: Session, job_id: int):
    """
    Core Helper: Fetches Job, Equipment, and Manufacturer Specs.
    Used by both Repeatability and Reproducibility calculations.
    """
    # 1. Fetch Job
    job = db.query(HTWJob).filter(HTWJob.job_id == job_id).first()
    if not job:
        raise ValueError(f"Job ID {job_id} not found")

    # 2. Fetch Equipment
    eqp = db.query(InwardEquipment).filter(InwardEquipment.inward_eqp_id == job.inward_eqp_id).first()
    if not eqp:
        raise ValueError("Equipment details not found for this job")

    # 3. Fetch Manufacturer Specs
    specs = db.query(HTWManufacturerSpec).filter(
        and_(
            HTWManufacturerSpec.make == eqp.make, 
            HTWManufacturerSpec.model == eqp.model,
            HTWManufacturerSpec.is_active == True
        )
    ).first()
    
    if not specs:
        raise ValueError(f"Manufacturer specifications not found for Make: {eqp.make}, Model: {eqp.model}")
        
    return job, specs

# ==================================================================================
#                           SECTION A: REPEATABILITY
# ==================================================================================

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
        # Linear Interpolation Formula
        raw_y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))

    abs_y = abs(raw_y)
    return round(abs_y, 2)

def process_repeatability_calculation(db: Session, request: RepeatabilityCalculationRequest):
    """
    Main logic to calculate Mean, Interpolation, Deviation for Repeatability.
    """
    job, specs = get_job_and_specs(db, request.job_id)
    results_summary = []

    # Get units from specs for response
    p_unit = specs.pressure_unit or ""
    t_unit = specs.torque_unit or ""

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
            "deviation_percent": deviation_percent,
            "pressure_unit": p_unit, 
            "torque_unit": t_unit,   
            "stored_readings": readings
        })

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "results": results_summary
    }

def get_stored_repeatability(db: Session, job_id: int):
    """
    Fetches existing repeatability data (Headers + Readings) for a job.
    Includes Pressure/Torque Units from Manufacturer Specs.
    """
    # 1. Always fetch specs first to get Units
    try:
        job, specs = get_job_and_specs(db, job_id)
        p_unit = specs.pressure_unit or ""
        t_unit = specs.torque_unit or ""
    except ValueError:
        return {"job_id": job_id, "status": "no_specs", "results": []}

    # 2. Fetch existing calculation data
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
                "stored_readings": reading_values,
                "pressure_unit": p_unit, 
                "torque_unit": t_unit    
            })
    else:
        # CASE B: No Calculation Data (New Job)
        # Populate Set Values from specs, leave readings empty
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
                "stored_readings": [], 
                "pressure_unit": p_unit, 
                "torque_unit": t_unit    
            })

    return {
        "job_id": job_id,
        "status": "success",
        "results": results_summary
    }

def get_uncertainty_references(db: Session):
    """
    Returns the full reference table sorted by torque.
    Used by frontend for dynamic real-time interpolation.
    """
    try:
        refs = db.query(HTWStandardUncertaintyReference).filter(
            HTWStandardUncertaintyReference.is_active == True
        ).order_by(asc(HTWStandardUncertaintyReference.indicated_torque)).all()
        
        return [
            {
                "indicated_torque": float(r.indicated_torque),
                "error_value": float(r.error_value)
            }
            for r in refs
        ]
    except Exception as e:
        print(f"DB Error getting references: {e}")
        return []

# ==================================================================================
#                           SECTION B: REPRODUCIBILITY
# ==================================================================================

def get_job_and_20_percent_torque(db: Session, job_id: int):
    """
    Fetches the 20% torque value via the shared helper.
    """
    job, specs = get_job_and_specs(db, job_id)
    
    if specs.torque_20 is None:
        raise ValueError("20% Torque value is missing in Manufacturer Specifications")
    
    return float(specs.torque_20), specs

def process_reproducibility_calculation(db: Session, request: ReproducibilityCalculationRequest):
    """
    Calculates b_rep (Range of Means) for 4 sequences.
    """
    # 1. Get the Set Torque (20% value) and specs for Unit
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    torque_unit = specs.torque_unit or ""

    # 2. Process Sequences
    sequence_results = []
    all_means = []

    if len(request.sequences) != 4:
        raise ValueError("Exactly 4 sequences (I, II, III, IV) are required for Reproducibility.")

    for seq in request.sequences:
        mean_val = sum(seq.readings) / len(seq.readings)
        all_means.append(mean_val)
        
        sequence_results.append({
            "sequence_no": seq.sequence_no,
            "readings": seq.readings,
            "mean_xr": mean_val
        })

    # 3. Calculate Error due to Reproducibility (b_rep)
    # Formula: b_rep = Max(Means) - Min(Means)
    b_rep = max(all_means) - min(all_means)
    b_rep_rounded = round(b_rep, 4)

    # --- DB OPERATIONS ---

    # 4. Clear existing Reproducibility data
    db.query(HTWReproducibility).filter(HTWReproducibility.job_id == request.job_id).delete(synchronize_session=False)
    db.flush()

    # 5. Insert New Data
    for seq_item in sequence_results:
        # Create Parent Row
        repro_entry = HTWReproducibility(
            job_id=request.job_id,
            set_torque_ts=set_torque_val,
            sequence_no=seq_item['sequence_no'],
            mean_xr=seq_item['mean_xr'],
            error_due_to_reproducibility=b_rep_rounded,
            created_at=datetime.now()
        )
        db.add(repro_entry)
        db.flush() 

        # Create Child Rows
        reading_rows = []
        for i, val in enumerate(seq_item['readings'], start=1):
            reading_rows.append(HTWReproducibilityReading(
                reproducibility_id=repro_entry.id,
                reading_order=i,
                indicated_reading=val
            ))
        db.add_all(reading_rows)

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "set_torque_20": set_torque_val,
        "error_due_to_reproducibility": b_rep_rounded,
        "torque_unit": torque_unit,  # Return unit so UI can update immediately
        "sequences": sequence_results
    }

def get_stored_reproducibility(db: Session, job_id: int):
    """
    Retrieves saved data. If no data exists, returns the Set Torque (20%).
    Also returns the Torque Unit.
    """
    
    # Fetch Set Torque & Specs
    try:
        set_torque_val, specs = get_job_and_20_percent_torque(db, job_id)
        torque_unit = specs.torque_unit or ""
    except Exception:
        set_torque_val = 0.0
        torque_unit = ""

    # Fetch stored sequences
    repro_rows = db.query(HTWReproducibility).filter(
        HTWReproducibility.job_id == job_id
    ).order_by(HTWReproducibility.sequence_no).all()

    sequences = []
    b_rep = 0.0

    if repro_rows:
        # b_rep is stored in every row for the job
        b_rep = float(repro_rows[0].error_due_to_reproducibility or 0)
        
        for row in repro_rows:
            readings_db = db.query(HTWReproducibilityReading).filter(
                HTWReproducibilityReading.reproducibility_id == row.id
            ).order_by(HTWReproducibilityReading.reading_order).all()
            
            readings_list = [float(r.indicated_reading) for r in readings_db]

            sequences.append({
                "sequence_no": row.sequence_no,
                "mean_xr": float(row.mean_xr or 0),
                "readings": readings_list
            })

    return {
        "job_id": job_id,
        "status": "success" if repro_rows else "no_data",
        "set_torque_20": set_torque_val,
        "error_due_to_reproducibility": b_rep,
        "torque_unit": torque_unit,
        "sequences": sequences
    }