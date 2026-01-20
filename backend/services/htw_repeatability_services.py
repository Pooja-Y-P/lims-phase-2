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
    HTWReproducibilityReading,
    HTWOutputDriveVariation, HTWOutputDriveVariationReading,
    HTWDriveInterfaceVariation, HTWDriveInterfaceVariationReading,
    HTWLoadingPointVariation, HTWLoadingPointVariationReading
)

# --- SCHEMAS ---
from backend.schemas.htw_repeatability_schemas import (
    RepeatabilityCalculationRequest, 
    ReproducibilityCalculationRequest,
    GeometricCalculationRequest, 
    LoadingPointRequest
)

# ==================================================================================
#                                SHARED HELPERS
# ==================================================================================

def get_job_and_specs(db: Session, job_id: int):
    """
    Core Helper: Fetches Job, Equipment, and Manufacturer Specs.
    """
    job = db.query(HTWJob).filter(HTWJob.job_id == job_id).first()
    if not job:
        raise ValueError(f"Job ID {job_id} not found")

    eqp = db.query(InwardEquipment).filter(InwardEquipment.inward_eqp_id == job.inward_eqp_id).first()
    if not eqp:
        raise ValueError("Equipment details not found for this job")

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

def get_job_and_20_percent_torque(db: Session, job_id: int):
    """
    Helper: Fetches the 20% Set Torque value.
    Used by Sections B, C, D, E.
    """
    job, specs = get_job_and_specs(db, job_id)
    if specs.torque_20 is None:
        raise ValueError("20% Torque value is missing in Manufacturer Specifications")
    return float(specs.torque_20), specs

# ==================================================================================
#                           SECTION A: REPEATABILITY
# ==================================================================================

def get_set_values_safe(specs: HTWManufacturerSpec, step_percent: float):
    """
    Helper to fetch specs. 
    Returns (Pressure, Torque) for 20/60/100.
    Returns (None, None) for other steps (40, 80, etc.) instead of raising error.
    """
    percent = int(step_percent)
    if percent == 20:
        return specs.pressure_20, specs.torque_20
    elif percent == 60:
        return specs.pressure_60, specs.torque_60
    elif percent == 100:
        return specs.pressure_100, specs.torque_100
    return None, None

def calculate_interpolation(db: Session, mean_xr: float) -> float:
    """
    Calculates Interpolated Error using htw_standard_uncertainty_reference.
    """
    val = float(mean_xr)

    # 1. Find Lower Neighbor
    lower_ref = db.query(HTWStandardUncertaintyReference).filter(
        and_(HTWStandardUncertaintyReference.indicated_torque <= val, HTWStandardUncertaintyReference.is_active == True)
    ).order_by(desc(HTWStandardUncertaintyReference.indicated_torque)).first()

    # 2. Find Higher Neighbor
    upper_ref = db.query(HTWStandardUncertaintyReference).filter(
        and_(HTWStandardUncertaintyReference.indicated_torque >= val, HTWStandardUncertaintyReference.is_active == True)
    ).order_by(asc(HTWStandardUncertaintyReference.indicated_torque)).first()

    # Scenarios
    if not lower_ref and not upper_ref: return 0.0
    if not lower_ref and upper_ref: return abs(float(upper_ref.error_value))
    if lower_ref and not upper_ref: return abs(float(lower_ref.error_value))
    if lower_ref.id == upper_ref.id: return abs(float(lower_ref.error_value))

    # Linear Interpolation
    x, x1, y1, x2, y2 = val, float(lower_ref.indicated_torque), float(lower_ref.error_value), float(upper_ref.indicated_torque), float(upper_ref.error_value)
    
    if (x2 - x1) == 0: 
        raw_y = y1
    else: 
        raw_y = y1 + ((x - x1) * (y2 - y1) / (x2 - x1))
        
    return round(abs(raw_y), 2)

def process_repeatability_calculation(db: Session, request: RepeatabilityCalculationRequest):
    """
    Main logic: Uses manual input if provided, otherwise falls back to specs.
    Calculates Mean, Interpolation, and Deviation.
    """
    job, specs = get_job_and_specs(db, request.job_id)
    results_summary = []

    p_unit = specs.pressure_unit or ""
    t_unit = specs.torque_unit or ""

    for step_data in request.steps:
        
        # --- A. DETERMINE SET PRESSURE & SET TORQUE ---
        
        # Priority 1: Use values sent from Frontend (Manual Override / Custom Steps)
        ps = step_data.set_pressure if step_data.set_pressure is not None else 0.0
        ts = step_data.set_torque if step_data.set_torque is not None else 0.0

        # Priority 2: If Frontend sent 0 (or nothing), try fetching from Manufacturer Specs
        # This preserves functionality for standard steps (20/60/100) if user sends empty.
        if ps == 0 or ts == 0:
            spec_ps, spec_ts = get_set_values_safe(specs, step_data.step_percent)
            
            if ps == 0 and spec_ps is not None:
                ps = float(spec_ps)
            
            if ts == 0 and spec_ts is not None:
                ts = float(spec_ts)

        # B. Calculate Mean (Xr)
        readings = step_data.readings
        mean_xr = sum(readings) / len(readings)

        # C. Calculate Corrected Standard (Interpolation)
        corrected_standard = calculate_interpolation(db, mean_xr)

        # D. Calculate Corrected Mean
        corrected_mean = mean_xr - corrected_standard

        # E. Calculate Deviation Percentage
        # Guard against Divide By Zero if Torque is 0 (e.g., initial 40% row)
        ts_float = float(ts)
        if ts_float != 0:
            raw_deviation = ((corrected_mean - ts_float) * 100) / ts_float
            deviation_percent = round(raw_deviation, 2)
        else:
            deviation_percent = 0.0

        # --- DB OPERATIONS ---

        # F. Delete existing record for this step
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
            set_pressure_ps=ps,  # Save the resolved Pressure (Manual or Spec)
            set_torque_ts=ts,    # Save the resolved Torque (Manual or Spec)
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

def process_repeatability_draft(db: Session, request: RepeatabilityCalculationRequest):
    """
    Service for the Draft Endpoint (Section A).
    """
    return process_repeatability_calculation(db, request)

def get_stored_repeatability(db: Session, job_id: int):
    """
    Fetches existing repeatability data.
    """
    try:
        job, specs = get_job_and_specs(db, job_id)
        p_unit = specs.pressure_unit or ""
        t_unit = specs.torque_unit or ""
    except ValueError:
        return {"job_id": job_id, "status": "no_specs", "results": []}

    steps_db = db.query(HTWRepeatability).filter(
        HTWRepeatability.job_id == job_id
    ).order_by(asc(HTWRepeatability.step_percent)).all()

    results_summary = []

    if steps_db:
        # CASE A: Return what is in DB
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
        # CASE B: No Data in DB yet. Return standard 20/60/100 defaults from specs.
        for step in [20.0, 60.0, 100.0]:
            ps, ts = get_set_values_safe(specs, step)
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
    try:
        refs = db.query(HTWStandardUncertaintyReference).filter(
            HTWStandardUncertaintyReference.is_active == True
        ).order_by(asc(HTWStandardUncertaintyReference.indicated_torque)).all()
        return [{"indicated_torque": float(r.indicated_torque), "error_value": float(r.error_value)} for r in refs]
    except Exception as e:
        print(f"DB Error getting references: {e}")
        return []

# ==================================================================================
#                           SECTION B: REPRODUCIBILITY
# ==================================================================================

def process_reproducibility_calculation(db: Session, request: ReproducibilityCalculationRequest):
    """
    Calculates b_rep (Range of Means) for 4 sequences.
    """
    # 1. Get the Set Torque (20% value) and specs for Unit
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    
    # Use requested unit if provided, else fallback to spec unit
    torque_unit = request.torque_unit or specs.torque_unit or ""

    sequence_results = []
    all_means = []

    if len(request.sequences) != 4:
        raise ValueError("Exactly 4 sequences (I, II, III, IV) are required for Reproducibility.")

    for seq in request.sequences:
        # Calculate mean of readings (zeros included)
        mean_val = sum(seq.readings) / len(seq.readings)
        
        # Only use valid means for b_rep calculation
        if mean_val > 0:
            all_means.append(mean_val)
        
        sequence_results.append({
            "sequence_no": seq.sequence_no,
            "readings": seq.readings,
            "mean_xr": mean_val
        })

    # 3. Calculate Error due to Reproducibility (b_rep)
    if len(all_means) >= 2:
        b_rep = max(all_means) - min(all_means)
    else:
        b_rep = 0.0
        
    b_rep_rounded = round(b_rep, 4)

    # --- DB OPERATIONS ---
    db.query(HTWReproducibility).filter(HTWReproducibility.job_id == request.job_id).delete(synchronize_session=False)
    db.flush()

    for seq_item in sequence_results:
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
        "torque_unit": torque_unit,
        "sequences": sequence_results
    }

def process_reproducibility_draft(db: Session, request: ReproducibilityCalculationRequest):
    """
    Draft service wrapper for Section B.
    """
    return process_reproducibility_calculation(db, request)

def get_stored_reproducibility(db: Session, job_id: int):
    try:
        set_torque_val, specs = get_job_and_20_percent_torque(db, job_id)
        torque_unit = specs.torque_unit or ""
    except Exception:
        set_torque_val = 0.0
        torque_unit = ""

    repro_rows = db.query(HTWReproducibility).filter(
        HTWReproducibility.job_id == job_id
    ).order_by(HTWReproducibility.sequence_no).all()

    sequences = []
    b_rep = 0.0

    if repro_rows:
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

# ==================================================================================
#                     SECTION C: OUTPUT DRIVE VARIATION (b_out)
# ==================================================================================

def process_output_drive_calculation(db: Session, request: GeometricCalculationRequest):
    # UPDATED: Use 20% torque instead of 100%
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    torque_unit = specs.torque_unit or ""
    
    position_results = []
    means = []

    for pos in request.positions:
        mean_val = sum(pos.readings) / len(pos.readings)
        means.append(mean_val)
        position_results.append({
            "position_deg": pos.position_deg,
            "readings": pos.readings,
            "mean_value": mean_val
        })

    if not means:
        b_out = 0.0
    else:
        b_out = max(means) - min(means)
    
    b_out_rounded = round(b_out, 4)

    db.query(HTWOutputDriveVariation).filter(HTWOutputDriveVariation.job_id == request.job_id).delete(synchronize_session=False)
    db.flush()

    for item in position_results:
        var_entry = HTWOutputDriveVariation(
            job_id=request.job_id,
            set_torque_ts=set_torque_val,
            position_deg=item['position_deg'],
            mean_value=item['mean_value'],
            error_due_output_drive_bout=b_out_rounded, 
            created_at=datetime.now()
        )
        db.add(var_entry)
        db.flush()

        readings_rows = [
            HTWOutputDriveVariationReading(
                output_drive_variation_id=var_entry.id,
                reading_order=i,
                indicated_reading=val
            ) for i, val in enumerate(item['readings'], start=1)
        ]
        db.add_all(readings_rows)

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "set_torque": set_torque_val,
        "error_value": b_out_rounded,
        "torque_unit": torque_unit,
        "positions": position_results
    }

def process_output_drive_draft(db: Session, request: GeometricCalculationRequest):
    """
    Draft service wrapper for Section C.
    """
    return process_output_drive_calculation(db, request)

def get_stored_output_drive(db: Session, job_id: int):
    try:
        set_torque_val, specs = get_job_and_20_percent_torque(db, job_id)
        torque_unit = specs.torque_unit or ""
    except:
        set_torque_val = 0.0
        torque_unit = ""

    rows = db.query(HTWOutputDriveVariation).filter(
        HTWOutputDriveVariation.job_id == job_id
    ).order_by(HTWOutputDriveVariation.position_deg).all()

    means = []
    positions = []

    for row in rows:
        readings_db = db.query(HTWOutputDriveVariationReading).filter(
            HTWOutputDriveVariationReading.output_drive_variation_id == row.id
        ).order_by(HTWOutputDriveVariationReading.reading_order).all()
        
        vals = [float(r.indicated_reading) for r in readings_db]
        mean_val = float(row.mean_value or 0)
        means.append(mean_val)
        
        positions.append({
            "position_deg": row.position_deg,
            "readings": vals,
            "mean_value": mean_val
        })

    b_out = (max(means) - min(means)) if means else 0.0

    return {
        "job_id": job_id,
        "status": "success" if rows else "no_data",
        "set_torque": set_torque_val,
        "error_value": round(b_out, 4),
        "torque_unit": torque_unit,
        "positions": positions
    }

# ==================================================================================
#                   SECTION D: DRIVE INTERFACE VARIATION (b_int)
# ==================================================================================

def process_drive_interface_calculation(db: Session, request: GeometricCalculationRequest):
    # UPDATED: Use 20% torque instead of 100%
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    torque_unit = specs.torque_unit or ""

    position_results = []
    means = []

    for pos in request.positions:
        mean_val = sum(pos.readings) / len(pos.readings)
        means.append(mean_val)
        position_results.append({
            "position_deg": pos.position_deg,
            "readings": pos.readings,
            "mean_value": mean_val
        })

    if not means:
        b_int = 0.0
    else:
        b_int = max(means) - min(means)
    
    b_int_rounded = round(b_int, 4)

    db.query(HTWDriveInterfaceVariation).filter(HTWDriveInterfaceVariation.job_id == request.job_id).delete(synchronize_session=False)
    db.flush()

    for item in position_results:
        var_entry = HTWDriveInterfaceVariation(
            job_id=request.job_id,
            set_torque_ts=set_torque_val,
            position_deg=item['position_deg'],
            mean_value=item['mean_value'],
            error_due_drive_interface_bint=b_int_rounded,
            created_at=datetime.now()
        )
        db.add(var_entry)
        db.flush()

        readings_rows = [
            HTWDriveInterfaceVariationReading(
                drive_interface_variation_id=var_entry.id,
                reading_order=i,
                indicated_reading=val
            ) for i, val in enumerate(item['readings'], start=1)
        ]
        db.add_all(readings_rows)

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "set_torque": set_torque_val,
        "error_value": b_int_rounded,
        "torque_unit": torque_unit,
        "positions": position_results
    }

def process_drive_interface_draft(db: Session, request: GeometricCalculationRequest):
    """
    Draft service wrapper for Section D.
    """
    return process_drive_interface_calculation(db, request)

def get_stored_drive_interface(db: Session, job_id: int):
    try:
        set_torque_val, specs = get_job_and_20_percent_torque(db, job_id)
        torque_unit = specs.torque_unit or ""
    except:
        set_torque_val = 0.0
        torque_unit = ""

    rows = db.query(HTWDriveInterfaceVariation).filter(
        HTWDriveInterfaceVariation.job_id == job_id
    ).order_by(HTWDriveInterfaceVariation.position_deg).all()

    means = []
    positions = []

    for row in rows:
        readings_db = db.query(HTWDriveInterfaceVariationReading).filter(
            HTWDriveInterfaceVariationReading.drive_interface_variation_id == row.id
        ).order_by(HTWDriveInterfaceVariationReading.reading_order).all()
        
        vals = [float(r.indicated_reading) for r in readings_db]
        mean_val = float(row.mean_value or 0)
        means.append(mean_val)
        
        positions.append({
            "position_deg": row.position_deg,
            "readings": vals,
            "mean_value": mean_val
        })

    b_int = (max(means) - min(means)) if means else 0.0

    return {
        "job_id": job_id,
        "status": "success" if rows else "no_data",
        "set_torque": set_torque_val,
        "error_value": round(b_int, 4),
        "torque_unit": torque_unit,
        "positions": positions
    }

# ==================================================================================
#                     SECTION E: LOADING POINT VARIATION (b_l)
# ==================================================================================

def process_loading_point_calculation(db: Session, request: LoadingPointRequest):
    # UPDATED: Use 20% torque instead of 100%
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    torque_unit = specs.torque_unit or ""

    position_results = []
    mean_dict = {}

    for pos in request.positions:
        mean_val = sum(pos.readings) / len(pos.readings)
        mean_dict[pos.loading_position_mm] = mean_val
        
        position_results.append({
            "loading_position_mm": pos.loading_position_mm,
            "readings": pos.readings,
            "mean_value": mean_val
        })

    if -10 in mean_dict and 10 in mean_dict:
        b_l = abs(mean_dict[-10] - mean_dict[10])
    else:
        b_l = 0.0

    b_l_rounded = round(b_l, 4)

    db.query(HTWLoadingPointVariation).filter(HTWLoadingPointVariation.job_id == request.job_id).delete(synchronize_session=False)
    db.flush()

    for item in position_results:
        var_entry = HTWLoadingPointVariation(
            job_id=request.job_id,
            set_torque_ts=set_torque_val,
            loading_position_mm=item['loading_position_mm'],
            mean_value=item['mean_value'],
            error_due_loading_point_bl=b_l_rounded,
            created_at=datetime.now()
        )
        db.add(var_entry)
        db.flush()

        readings_rows = [
            HTWLoadingPointVariationReading(
                loading_point_variation_id=var_entry.id,
                reading_order=i,
                indicated_reading=val
            ) for i, val in enumerate(item['readings'], start=1)
        ]
        db.add_all(readings_rows)

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "set_torque": set_torque_val,
        "error_due_to_loading_point": b_l_rounded,
        "torque_unit": torque_unit,
        "positions": position_results
    }

def process_loading_point_draft(db: Session, request: LoadingPointRequest):
    """
    Draft service wrapper for Section E.
    """
    return process_loading_point_calculation(db, request)

def get_stored_loading_point(db: Session, job_id: int):
    try:
        set_torque_val, specs = get_job_and_20_percent_torque(db, job_id)
        torque_unit = specs.torque_unit or ""
    except:
        set_torque_val = 0.0
        torque_unit = ""

    rows = db.query(HTWLoadingPointVariation).filter(
        HTWLoadingPointVariation.job_id == job_id
    ).order_by(HTWLoadingPointVariation.loading_position_mm).all()

    positions = []
    mean_dict = {}

    for row in rows:
        readings_db = db.query(HTWLoadingPointVariationReading).filter(
            HTWLoadingPointVariationReading.loading_point_variation_id == row.id
        ).order_by(HTWLoadingPointVariationReading.reading_order).all()
        
        vals = [float(r.indicated_reading) for r in readings_db]
        mean_val = float(row.mean_value or 0)
        mean_dict[row.loading_position_mm] = mean_val
        
        positions.append({
            "loading_position_mm": row.loading_position_mm,
            "readings": vals,
            "mean_value": mean_val
        })

    if -10 in mean_dict and 10 in mean_dict:
        b_l = abs(mean_dict[-10] - mean_dict[10])
    else:
        b_l = 0.0

    return {
        "job_id": job_id,
        "status": "success" if rows else "no_data",
        "set_torque": set_torque_val,
        "error_due_to_loading_point": round(b_l, 4),
        "torque_unit": torque_unit,
        "positions": positions
    }