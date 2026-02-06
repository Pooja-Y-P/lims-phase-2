from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import date
from typing import Dict, Any, Optional

from backend.models.inward_equipments import InwardEquipment
from backend.models.htw_manufacturer_spec import HTWManufacturerSpec
from backend.models.htw_master_standard import HTWMasterStandard
from backend.models.htw_nomenclature_range import HTWNomenclatureRange
from backend.models.htw_job_standard_snapshot import HTWJobStandardSnapshot

def auto_select_standards_for_job(
    *,
    db: Session,
    job_id: int,
    inward_eqp_id: int,
    job_date: date,
    standard_overrides: Optional[Dict[str, Any]] = None
):
    # 0. Idempotency guard: Clear previous auto-selections for this job
    db.query(HTWJobStandardSnapshot).filter(HTWJobStandardSnapshot.job_id == job_id).delete()
    db.flush()

    # 1. Fetch inward equipment
    inward = db.query(InwardEquipment).filter(InwardEquipment.inward_eqp_id == inward_eqp_id).first()
    if not inward:
        raise ValueError("Inward equipment not found")

    # 2. Manufacturer spec
    spec = db.query(HTWManufacturerSpec).filter(
        HTWManufacturerSpec.make == inward.make,
        HTWManufacturerSpec.model == inward.model,
        HTWManufacturerSpec.is_active.is_(True)
    ).first()
    
    if not spec:
        raise ValueError(f"Manufacturer specification not found for {inward.make} {inward.model}")

    # 3. Determine Effective Torque Range
    target_min = float(spec.torque_20)
    target_max = float(spec.torque_100)

    # --- CHECK ACTUAL SAVED STEPS (Robust Raw SQL) ---
    try:
        # Use nested transaction to prevent 'Transaction Aborted' errors
        with db.begin_nested():
            sql = text("""
                SELECT MIN(set_torque_ts), MAX(set_torque_ts) 
                FROM htw_repeatability 
                WHERE job_id = :job_id AND set_torque_ts > 0
            """)
            result = db.execute(sql, {"job_id": job_id}).fetchone()

            if result and result[0] is not None:
                actual_min_step = float(result[0])
                actual_max_step = float(result[1])

                if actual_min_step < target_min:
                    target_min = actual_min_step
                
                if actual_max_step > target_max:
                    target_max = actual_max_step
    except Exception:
        # Continue using spec defaults if SQL fails (e.g., table missing or empty)
        pass

    # 4. Min torque (Global Safety Floor)
    min_allowed_torque_val = db.query(func.min(HTWNomenclatureRange.range_min)).filter(
        HTWNomenclatureRange.is_active.is_(True),
        HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
    ).scalar()
    
    if min_allowed_torque_val is None:
        raise ValueError("Torque nomenclature ranges not configured")
    
    min_allowed_torque = float(min_allowed_torque_val)

    # Final DUC Range
    duc_min = max(target_min, min_allowed_torque)
    duc_max = max(target_max, min_allowed_torque)

    # 5. Torque ranges Selection
    # 5a. Find Range for Low End
    low_range = db.query(HTWNomenclatureRange).filter(
        HTWNomenclatureRange.is_active.is_(True),
        HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%"),
        HTWNomenclatureRange.range_min <= duc_min, 
        HTWNomenclatureRange.range_max >= duc_min  
    ).order_by(HTWNomenclatureRange.range_max.asc()).first()

    # 5b. Find Range for High End
    high_range = db.query(HTWNomenclatureRange).filter(
        HTWNomenclatureRange.is_active.is_(True),
        HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%"),
        HTWNomenclatureRange.range_min <= duc_max,
        HTWNomenclatureRange.range_max >= duc_max 
    ).order_by(HTWNomenclatureRange.range_max.asc()).first()

    torque_range_ids = []
    
    if not low_range and not high_range:
        raise ValueError(f"No valid Torque Transducers found for range {duc_min} - {duc_max}")

    if low_range:
        torque_range_ids.append(low_range.id)
    
    if high_range and (not low_range or high_range.id != low_range.id):
        torque_range_ids.append(high_range.id)

    # 6. Pressure range
    pressure_range = db.query(HTWNomenclatureRange).filter(
        HTWNomenclatureRange.is_active.is_(True),
        ~HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
    ).order_by(HTWNomenclatureRange.range_max.asc()).first()
    
    if not pressure_range:
        raise ValueError("Pressure nomenclature range not configured")
    
    required_range_ids = torque_range_ids + [pressure_range.id]

    # 7. Fetch standards
    standards = (
        db.query(HTWMasterStandard)
        .filter(
            HTWMasterStandard.nomenclature_range.any(HTWNomenclatureRange.id.in_(required_range_ids)),
            HTWMasterStandard.is_active.is_(True),
            HTWMasterStandard.calibration_valid_upto >= job_date
        )
        .order_by(HTWMasterStandard.range_max.asc())
        .all()
    )

    # Group standards
    std_by_range = {}
    for std in standards:
        matched_range_id = next((nr.id for nr in std.nomenclature_range if nr.id in required_range_ids), None)
        if matched_range_id:
            std_by_range.setdefault(matched_range_id, []).append(std)

    # 8. Snapshot freeze
    order = 1
    overrides = standard_overrides or {}

    for range_id in required_range_ids:
        std_list = std_by_range.get(range_id)
        if not std_list: continue
        
        std = std_list[0] # Default selection (first valid standard)

        # Logic to apply traceability override from Frontend
        traceability_val = std.traceable_to_lab
        for key in ['standard1', 'standard2', 'standard3']:
            item = overrides.get(key)
            if item and isinstance(item, dict) and item.get('id') == std.id:
                if item.get('traceable_to_lab'):
                    traceability_val = item.get('traceable_to_lab')

        snapshot = HTWJobStandardSnapshot(
            job_id=job_id,
            master_standard_id=std.id,
            standard_order=order,
            nomenclature=std.nomenclature,
            manufacturer=std.manufacturer,
            traceable_to_lab=traceability_val,
            model_serial_no=std.model_serial_no,
            certificate_no=std.certificate_no,
            calibration_valid_upto=std.calibration_valid_upto,
            uncertainty=std.uncertainty,
            uncertainty_unit=std.uncertainty_unit,
            resolution=std.resolution,
            resolution_unit=std.resolution_unit,
            accuracy_of_master=std.accuracy_of_master,
        )
        db.add(snapshot)
        order += 1

    db.commit()