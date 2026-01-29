import math
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
    HTWUnResolution, 
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
        # Fallback search logic in case of minor mismatches (Case sensitivity/Spacing)
        # matches the logic used in standard selection service
        search_make = eqp.make.strip()
        search_model = eqp.model.strip()
        
        if "/" in search_model:
            search_model = search_model.split("/")[-1].strip()

        specs = db.query(HTWManufacturerSpec).filter(
            HTWManufacturerSpec.make.ilike(search_make),
            HTWManufacturerSpec.model.ilike(search_model),
            HTWManufacturerSpec.is_active.is_(True)
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

def get_set_values_safe(specs: HTWManufacturerSpec, step_percent: float):
    """
    Helper to fetch specs. 
    Returns (Pressure, Torque) for 20/40/60/80/100.
    FIXED: Added 40% and 80% support.
    """
    percent = int(step_percent)
    if percent == 20:
        return specs.pressure_20, specs.torque_20
    elif percent == 40:
        return specs.pressure_40, specs.torque_40
    elif percent == 60:
        return specs.pressure_60, specs.torque_60
    elif percent == 80:
        return specs.pressure_80, specs.torque_80
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

# ==================================================================================
#                           SECTION A: REPEATABILITY
# ==================================================================================

# Lines 105-127 in your provided code
def delete_repeatability_step(db: Session, job_id: int, step_percent: float):
    """
    Deletes a specific repeatability step and its associated data.
    """
    # 1. Find the Header record
    header = db.query(HTWRepeatability).filter(
        and_(HTWRepeatability.job_id == job_id, HTWRepeatability.step_percent == step_percent)
    ).first()

    if header:
        # 2. Delete Readings associated with this header
        db.query(HTWRepeatabilityReading).filter(
            HTWRepeatabilityReading.repeatability_id == header.id
        ).delete(synchronize_session=False)

        # 3. Delete the Header
        db.delete(header)

    # 4. Delete associated UnResolution Data for this step
    db.query(HTWUnResolution).filter(
        and_(HTWUnResolution.job_id == job_id, HTWUnResolution.step_percent == step_percent)
    ).delete(synchronize_session=False)

    db.commit()
    return {"status": "success", "message": f"Deleted step {step_percent}% for job {job_id}"}

def process_repeatability_calculation(db: Session, request: RepeatabilityCalculationRequest):
    job, specs = get_job_and_specs(db, request.job_id)
    results_summary = []

    p_unit = specs.pressure_unit or ""
    t_unit = specs.torque_unit or ""

    for step_data in request.steps:
        
        # --- 1. CALCULATIONS ---
        ps = step_data.set_pressure if step_data.set_pressure is not None else 0.0
        ts = step_data.set_torque if step_data.set_torque is not None else 0.0

        # Retrieve Manufacturer Specs if 0 is passed
        if ps == 0 or ts == 0:
            spec_ps, spec_ts = get_set_values_safe(specs, step_data.step_percent)
            if ps == 0 and spec_ps is not None: ps = float(spec_ps)
            if ts == 0 and spec_ts is not None: ts = float(spec_ts)

        readings = step_data.readings
        n = len(readings)
        
        if n > 0:
            mean_xr = sum(readings) / n
        else:
            mean_xr = 0.0

        corrected_standard = calculate_interpolation(db, mean_xr)
        corrected_mean = mean_xr - corrected_standard

        ts_float = float(ts)
        if ts_float != 0:
            raw_deviation = ((corrected_mean - ts_float) * 100) / ts_float
            deviation_percent = round(raw_deviation, 2)
        else:
            deviation_percent = 0.0

        # UnResolution Calculations
        me_list = []
        rme_list = []
        dev_list = []
        sum_sq_diff_for_std_dev = 0.0

        for r in readings:
            # Measurement Error
            me =  ts_float - r
            me_list.append(round(me, 4))
            
            # Relative Measurement Error (Round to 3)
            if r != 0:
                rme = (me * 100) / r
            else:
                rme = 0.0
            rme_list.append(round(rme, 3)) 

            # Deviation (Round to 3)
            dev = r - corrected_mean
            dev_list.append(round(dev, 3)) 
            
            # Variance Prep
            sum_sq_diff_for_std_dev += (r - mean_xr) ** 2

        # a_s = Average of Relative Measurement Error (Round to 3)
        a_s_raw = sum(rme_list) / n if n > 0 else 0.0
        a_s = round(a_s_raw, 3)

        # Variation due to Repeatability (Round to 2)
        if n > 1:
            variance = sum_sq_diff_for_std_dev / (n - 1)
            variation_s = math.sqrt(variance)
        else:
            variation_s = 0.0
        
        variation_s = round(variation_s, 2)

        # --- 2. DB OPERATIONS (UPSERT) ---

        # A. HEADER UPSERT
        rep_header = db.query(HTWRepeatability).filter(
            and_(HTWRepeatability.job_id == request.job_id, HTWRepeatability.step_percent == step_data.step_percent)
        ).first()

        if rep_header:
            # Update Existing
            rep_header.set_pressure_ps = ps
            rep_header.set_torque_ts = ts
            rep_header.mean_xr = mean_xr
            rep_header.corrected_standard = corrected_standard
            rep_header.corrected_mean = corrected_mean
            rep_header.deviation_percent = deviation_percent
        else:
            # Insert New
            rep_header = HTWRepeatability(
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
            db.add(rep_header)
        
        db.flush() # Ensure ID exists

        # B. READINGS UPSERT
        # Iterate provided readings and update by order. 
        for i, val in enumerate(readings, start=1):
            reading_entry = db.query(HTWRepeatabilityReading).filter(
                and_(
                    HTWRepeatabilityReading.repeatability_id == rep_header.id,
                    HTWRepeatabilityReading.reading_order == i
                )
            ).first()

            if reading_entry:
                reading_entry.indicated_reading = val
            else:
                db.add(HTWRepeatabilityReading(
                    repeatability_id=rep_header.id,
                    reading_order=i,
                    indicated_reading=val
                ))
        
        # Clean up excess readings (if user reduced count from 10 to 5, delete 6-10)
        db.query(HTWRepeatabilityReading).filter(
            and_(
                HTWRepeatabilityReading.repeatability_id == rep_header.id,
                HTWRepeatabilityReading.reading_order > len(readings)
            )
        ).delete(synchronize_session=False)

        # C. UNRESOLUTION UPSERT
        un_res_entry = db.query(HTWUnResolution).filter(
            and_(HTWUnResolution.job_id == request.job_id, HTWUnResolution.step_percent == step_data.step_percent)
        ).first()

        if un_res_entry:
            un_res_entry.measurement_error = me_list
            un_res_entry.relative_measurement_error = rme_list
            un_res_entry.deviation = dev_list
            un_res_entry.a_s = a_s
            un_res_entry.variation_due_to_repeatability = variation_s
        else:
            un_res_entry = HTWUnResolution(
                job_id=request.job_id,
                step_percent=step_data.step_percent,
                measurement_error=me_list,           
                relative_measurement_error=rme_list, 
                deviation=dev_list,                  
                a_s=a_s,
                variation_due_to_repeatability=variation_s
            )
            db.add(un_res_entry)
        
        # Build Response
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
            "stored_readings": readings,
            "un_resolution": {
                "measurement_error": me_list,
                "relative_measurement_error": rme_list,
                "deviation": dev_list,
                "a_s": a_s,
                "variation_due_to_repeatability": variation_s
            }
        })

    db.commit()

    return {
        "job_id": request.job_id,
        "status": "success",
        "results": results_summary
    }

def process_repeatability_draft(db: Session, request: RepeatabilityCalculationRequest):
    return process_repeatability_calculation(db, request)

def get_stored_repeatability(db: Session, job_id: int):
    try:
        job, specs = get_job_and_specs(db, job_id)
        p_unit = specs.pressure_unit or ""
        t_unit = specs.torque_unit or ""
    except ValueError:
        return {"job_id": job_id, "status": "no_specs", "results": [], "defaults": {}}

    # 1. Fetch all existing steps from Database
    steps_db = db.query(HTWRepeatability).filter(
        HTWRepeatability.job_id == job_id
    ).order_by(asc(HTWRepeatability.step_percent)).all()

    results_summary = []
    found_percentages = set()

    # 2. Process Existing DB Rows
    if steps_db:
        for step_row in steps_db:
            step_val = float(step_row.step_percent)
            found_percentages.add(step_val)

            readings_db = db.query(HTWRepeatabilityReading).filter(
                HTWRepeatabilityReading.repeatability_id == step_row.id
            ).order_by(HTWRepeatabilityReading.reading_order).all()

            reading_values = [float(r.indicated_reading) for r in readings_db]

            un_res_row = db.query(HTWUnResolution).filter(
                and_(HTWUnResolution.job_id == job_id, HTWUnResolution.step_percent == step_row.step_percent)
            ).first()

            un_res_data = None
            if un_res_row:
                un_res_data = {
                    "measurement_error": un_res_row.measurement_error,
                    "relative_measurement_error": un_res_row.relative_measurement_error,
                    "deviation": un_res_row.deviation,
                    "a_s": float(un_res_row.a_s or 0),
                    "variation_due_to_repeatability": float(un_res_row.variation_due_to_repeatability or 0)
                }

            results_summary.append({
                "step_percent": step_val,
                "mean_xr": float(step_row.mean_xr) if step_row.mean_xr is not None else 0.0,
                "set_pressure": float(step_row.set_pressure_ps) if step_row.set_pressure_ps is not None else 0.0,
                "set_torque": float(step_row.set_torque_ts) if step_row.set_torque_ts is not None else 0.0,
                "corrected_standard": float(step_row.corrected_standard) if step_row.corrected_standard is not None else 0.0,
                "corrected_mean": float(step_row.corrected_mean) if step_row.corrected_mean is not None else 0.0,
                "deviation_percent": float(step_row.deviation_percent) if step_row.deviation_percent is not None else 0.0,
                "stored_readings": reading_values,
                "pressure_unit": p_unit, 
                "torque_unit": t_unit,
                "un_resolution": un_res_data
            })

    # 3. Handle Mandatory Defaults (20, 60, 100)
    # These must appear in the grid even if not in DB.
    mandatory_defaults = [20.0, 60.0, 100.0]
    for step in mandatory_defaults:
        if step not in found_percentages:
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
                "torque_unit": t_unit,
                "un_resolution": None
            })

    results_summary.sort(key=lambda x: x["step_percent"])

    # 4. Generate "defaults" map for frontend (CRITICAL STEP)
    # This prepares the data for 40 and 80 so the frontend has it ready when toggled.
    all_defaults = {}
    standard_steps = [20.0, 40.0, 60.0, 80.0, 100.0]
    for step in standard_steps:
        ps, ts = get_set_values_safe(specs, step)
        key = str(int(step)) # Keys will be "20", "40", "60", "80", "100"
        
        all_defaults[key] = {
            "set_pressure": float(ps) if ps is not None else 0.0,
            "set_torque": float(ts) if ts is not None else 0.0
        }

    # 5. Return everything including defaults
    return {
        "job_id": job_id,
        "status": "success",
        "results": results_summary,
        "defaults": all_defaults  # <--- THIS MUST BE HERE
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
    # 1. Get the Set Torque (20% value) and specs for Unit
    set_torque_val, specs = get_job_and_20_percent_torque(db, request.job_id)
    
    # Use requested unit if provided, else fallback to spec unit
    torque_unit = request.torque_unit or specs.torque_unit or ""

    sequence_results = []
    all_means = []

    if len(request.sequences) != 4:
        raise ValueError("Exactly 4 sequences (I, II, III, IV) are required for Reproducibility.")

    for seq in request.sequences:
        mean_val = sum(seq.readings) / len(seq.readings)
        
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

    # --- DB OPERATIONS (UPSERT) ---
    for seq_item in sequence_results:
        
        # A. Header Upsert
        repro_entry = db.query(HTWReproducibility).filter(
            and_(
                HTWReproducibility.job_id == request.job_id, 
                HTWReproducibility.sequence_no == seq_item['sequence_no']
            )
        ).first()

        if repro_entry:
            repro_entry.set_torque_ts = set_torque_val
            repro_entry.mean_xr = seq_item['mean_xr']
            repro_entry.error_due_to_reproducibility = b_rep_rounded
        else:
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

        # B. Readings Upsert
        for i, val in enumerate(seq_item['readings'], start=1):
            reading_entry = db.query(HTWReproducibilityReading).filter(
                and_(
                    HTWReproducibilityReading.reproducibility_id == repro_entry.id,
                    HTWReproducibilityReading.reading_order == i
                )
            ).first()

            if reading_entry:
                reading_entry.indicated_reading = val
            else:
                db.add(HTWReproducibilityReading(
                    reproducibility_id=repro_entry.id,
                    reading_order=i,
                    indicated_reading=val
                ))
        
        # Clean excess
        db.query(HTWReproducibilityReading).filter(
            and_(
                HTWReproducibilityReading.reproducibility_id == repro_entry.id,
                HTWReproducibilityReading.reading_order > len(seq_item['readings'])
            )
        ).delete(synchronize_session=False)

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

    # --- DB OPERATIONS (UPSERT) ---
    for item in position_results:
        
        # A. Header Upsert
        var_entry = db.query(HTWOutputDriveVariation).filter(
            and_(
                HTWOutputDriveVariation.job_id == request.job_id, 
                HTWOutputDriveVariation.position_deg == item['position_deg']
            )
        ).first()

        if var_entry:
            var_entry.set_torque_ts = set_torque_val
            var_entry.mean_value = item['mean_value']
            var_entry.error_due_output_drive_bout = b_out_rounded
        else:
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

        # B. Readings Upsert
        for i, val in enumerate(item['readings'], start=1):
            reading_entry = db.query(HTWOutputDriveVariationReading).filter(
                and_(
                    HTWOutputDriveVariationReading.output_drive_variation_id == var_entry.id,
                    HTWOutputDriveVariationReading.reading_order == i
                )
            ).first()

            if reading_entry:
                reading_entry.indicated_reading = val
            else:
                db.add(HTWOutputDriveVariationReading(
                    output_drive_variation_id=var_entry.id,
                    reading_order=i,
                    indicated_reading=val
                ))
        
        # Clean excess
        db.query(HTWOutputDriveVariationReading).filter(
            and_(
                HTWOutputDriveVariationReading.output_drive_variation_id == var_entry.id,
                HTWOutputDriveVariationReading.reading_order > len(item['readings'])
            )
        ).delete(synchronize_session=False)

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

    # --- DB OPERATIONS (UPSERT) ---
    for item in position_results:
        
        # A. Header Upsert
        var_entry = db.query(HTWDriveInterfaceVariation).filter(
            and_(
                HTWDriveInterfaceVariation.job_id == request.job_id, 
                HTWDriveInterfaceVariation.position_deg == item['position_deg']
            )
        ).first()

        if var_entry:
            var_entry.set_torque_ts = set_torque_val
            var_entry.mean_value = item['mean_value']
            var_entry.error_due_drive_interface_bint = b_int_rounded
        else:
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

        # B. Readings Upsert
        for i, val in enumerate(item['readings'], start=1):
            reading_entry = db.query(HTWDriveInterfaceVariationReading).filter(
                and_(
                    HTWDriveInterfaceVariationReading.drive_interface_variation_id == var_entry.id,
                    HTWDriveInterfaceVariationReading.reading_order == i
                )
            ).first()

            if reading_entry:
                reading_entry.indicated_reading = val
            else:
                db.add(HTWDriveInterfaceVariationReading(
                    drive_interface_variation_id=var_entry.id,
                    reading_order=i,
                    indicated_reading=val
                ))
        
        # Clean excess
        db.query(HTWDriveInterfaceVariationReading).filter(
            and_(
                HTWDriveInterfaceVariationReading.drive_interface_variation_id == var_entry.id,
                HTWDriveInterfaceVariationReading.reading_order > len(item['readings'])
            )
        ).delete(synchronize_session=False)

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

    # --- DB OPERATIONS (UPSERT) ---
    for item in position_results:
        
        # A. Header Upsert
        var_entry = db.query(HTWLoadingPointVariation).filter(
            and_(
                HTWLoadingPointVariation.job_id == request.job_id, 
                HTWLoadingPointVariation.loading_position_mm == item['loading_position_mm']
            )
        ).first()

        if var_entry:
            var_entry.set_torque_ts = set_torque_val
            var_entry.mean_value = item['mean_value']
            var_entry.error_due_loading_point_bl = b_l_rounded
        else:
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

        # B. Readings Upsert
        for i, val in enumerate(item['readings'], start=1):
            reading_entry = db.query(HTWLoadingPointVariationReading).filter(
                and_(
                    HTWLoadingPointVariationReading.loading_point_variation_id == var_entry.id,
                    HTWLoadingPointVariationReading.reading_order == i
                )
            ).first()

            if reading_entry:
                reading_entry.indicated_reading = val
            else:
                db.add(HTWLoadingPointVariationReading(
                    loading_point_variation_id=var_entry.id,
                    reading_order=i,
                    indicated_reading=val
                ))
        
        # Clean excess
        db.query(HTWLoadingPointVariationReading).filter(
            and_(
                HTWLoadingPointVariationReading.loading_point_variation_id == var_entry.id,
                HTWLoadingPointVariationReading.reading_order > len(item['readings'])
            )
        ).delete(synchronize_session=False)

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

    b_l = abs(mean_dict.get(-10, 0) - mean_dict.get(10, 0)) if -10 in mean_dict and 10 in mean_dict else 0.0

    return {
        "job_id": job_id,
        "status": "success" if rows else "no_data",
        "set_torque": set_torque_val,
        "error_due_to_loading_point": round(b_l, 4),
        "torque_unit": torque_unit,
        "positions": positions
    }