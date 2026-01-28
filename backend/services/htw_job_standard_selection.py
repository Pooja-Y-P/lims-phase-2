from sqlalchemy.orm import Session
from sqlalchemy import func
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
    standard_overrides: Optional[Dict[str, Any]] = None  # Receives frontend data
):
    # 0. Idempotency guard
    db.query(HTWJobStandardSnapshot).filter(HTWJobStandardSnapshot.job_id == job_id).delete()
    db.flush()

    # 1. Fetch inward
    inward = db.query(InwardEquipment).filter(InwardEquipment.inward_eqp_id == inward_eqp_id).first()
    if not inward: raise ValueError("Inward equipment not found")

    # 2. Manufacturer spec
    spec = db.query(HTWManufacturerSpec).filter(
        HTWManufacturerSpec.make == inward.make,
        HTWManufacturerSpec.model == inward.model,
        HTWManufacturerSpec.is_active.is_(True)
    ).first()
    if not spec: raise ValueError("Manufacturer specification not found")

    # 3. Min torque
    min_allowed_torque = db.query(func.min(HTWNomenclatureRange.range_min)).filter(
        HTWNomenclatureRange.is_active.is_(True),
        HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
    ).scalar()
    if min_allowed_torque is None: raise ValueError("Torque nomenclature ranges not configured")

    duc_min = max(spec.torque_20, min_allowed_torque)
    duc_max = max(spec.torque_100, min_allowed_torque)

    # 4. Torque ranges
    torque_ranges = db.query(HTWNomenclatureRange).filter(
        HTWNomenclatureRange.is_active.is_(True),
        HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%"),
        HTWNomenclatureRange.range_min <= duc_max,
        HTWNomenclatureRange.range_max >= duc_min
    ).order_by(HTWNomenclatureRange.range_min.asc()).all()
    if not torque_ranges: raise ValueError(f"No torque ranges for {duc_min}-{duc_max}")
    torque_range_ids = [r.id for r in torque_ranges]

    # 5. Pressure range
    pressure_range = db.query(HTWNomenclatureRange).filter(
        HTWNomenclatureRange.is_active.is_(True),
        ~HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
    ).order_by(HTWNomenclatureRange.range_max.asc()).first()
    if not pressure_range: raise ValueError("Pressure nomenclature range not configured")
    required_range_ids = torque_range_ids + [pressure_range.id]

    # 6. Fetch standards (FIXED: Uses .any() instead of .has())
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
    if not standards: raise ValueError(f"No valid master standards for ranges {required_range_ids}")

    # Group standards (FIXED: Iterates list)
    std_by_range = {}
    for std in standards:
        matched_range_id = next((nr.id for nr in std.nomenclature_range if nr.id in required_range_ids), None)
        if matched_range_id:
            std_by_range.setdefault(matched_range_id, []).append(std)

    # 7. Snapshot freeze (FIXED: Applies overrides)
    order = 1
    overrides = standard_overrides or {}

    for range_id in required_range_ids:
        std_list = std_by_range.get(range_id)
        if not std_list: raise ValueError(f"No master standard for range {range_id}")
        
        std = std_list[0] # Default selection

        # Logic to apply traceability override from Frontend
        traceability_val = std.traceable_to_lab
        # Check standard1, standard2, standard3 overrides
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
            traceable_to_lab=traceability_val, # SAVED HERE
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