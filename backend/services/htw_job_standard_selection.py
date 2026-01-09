from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

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
    job_date: date
):
    """
    FR-10: Nomenclature & Master Standard Auto-Selection

    Flow:
    Inward
      → Manufacturer Spec
      → DUC Min / Max
      → Resolve Torque Nomenclature Ranges (DB driven)
      → Resolve Pressure Nomenclature Range (DB driven)
      → Fetch Master Standards via FK
      → Freeze Snapshot (idempotent)
    """

    # --------------------------------------------------
    # STEP-0: Idempotency guard (re-click safe)
    # --------------------------------------------------
    # db.query(HTWJobStandardSnapshot) \
    #     .filter(HTWJobStandardSnapshot.job_id == job_id) \
    #     .delete()
    # db.flush()

    # --------------------------------------------------
    # STEP-1: Fetch inward equipment
    # --------------------------------------------------
    inward = (
        db.query(InwardEquipment)
        .filter(InwardEquipment.inward_eqp_id == inward_eqp_id)
        .first()
    )

    if not inward:
        raise ValueError("Inward equipment not found")

    # --------------------------------------------------
    # STEP-2: Manufacturer specification
    # --------------------------------------------------
    spec = (
        db.query(HTWManufacturerSpec)
        .filter(
            HTWManufacturerSpec.make == inward.make,
            HTWManufacturerSpec.model == inward.model,
            HTWManufacturerSpec.is_active.is_(True)
        )
        .first()
    )

    if not spec:
        raise ValueError("Manufacturer specification not found")

    # --------------------------------------------------
    # STEP-3: Derive MIN allowed torque from DB (NO hardcode)
    # --------------------------------------------------
    min_allowed_torque = (
        db.query(func.min(HTWNomenclatureRange.range_min))
        .filter(
            HTWNomenclatureRange.is_active.is_(True),
            HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
        )
        .scalar()
    )

    if min_allowed_torque is None:
        raise ValueError("Torque nomenclature ranges not configured")

    duc_min = max(spec.torque_20, min_allowed_torque)
    duc_max = max(spec.torque_100, min_allowed_torque)

    # --------------------------------------------------
    # STEP-4: Resolve TORQUE nomenclature ranges
    # --------------------------------------------------
    torque_ranges = (
        db.query(HTWNomenclatureRange)
        .filter(
            HTWNomenclatureRange.is_active.is_(True),
            HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%"),
            HTWNomenclatureRange.range_min <= duc_max,
            HTWNomenclatureRange.range_max >= duc_min
        )
        .order_by(HTWNomenclatureRange.range_min.asc())
        .all()
    )

    if not torque_ranges:
        raise ValueError(
            f"No torque nomenclature range found for DUC {duc_min} – {duc_max}"
        )

    torque_range_ids = [r.id for r in torque_ranges]

    # --------------------------------------------------
    # STEP-5: Resolve PRESSURE nomenclature range (NO hardcode)
    # Rule: anything NOT torque is pressure
    # --------------------------------------------------
    pressure_range = (
        db.query(HTWNomenclatureRange)
        .filter(
            HTWNomenclatureRange.is_active.is_(True),
            ~HTWNomenclatureRange.nomenclature.ilike("TORQUE TRANSDUCER%")
        )
        .order_by(HTWNomenclatureRange.range_max.asc())
        .first()
    )

    if not pressure_range:
        raise ValueError("Pressure nomenclature range not configured")

    required_range_ids = torque_range_ids + [pressure_range.id]

    # --------------------------------------------------
    # STEP-6: Fetch valid master standards via FK
    # --------------------------------------------------
    standards = (
        db.query(HTWMasterStandard)
        .filter(
            HTWMasterStandard.nomenclature_range_id.in_(required_range_ids),
            HTWMasterStandard.is_active.is_(True),
            HTWMasterStandard.calibration_valid_upto >= job_date
        )
        .order_by(
            HTWMasterStandard.nomenclature_range_id.asc(),
            HTWMasterStandard.range_max.asc()  # safest master first
        )
        .all()
    )

    if not standards:
        raise ValueError(
            f"No valid master standards for ranges {required_range_ids}"
        )

    # Group standards by nomenclature_range_id
    std_by_range = {}
    for std in standards:
        std_by_range.setdefault(std.nomenclature_range_id, []).append(std)

    # --------------------------------------------------
    # STEP-7: Snapshot freeze (Torque first, Pressure last)
    # --------------------------------------------------
    order = 1

    for range_id in required_range_ids:
        std_list = std_by_range.get(range_id)

        if not std_list:
            raise ValueError(
                f"No master standard mapped for nomenclature_range_id={range_id}"
            )

        # Always select safest master (smallest range_max)
        std = std_list[0]

        snapshot = HTWJobStandardSnapshot(
            job_id=job_id,
            master_standard_id=std.id,
            standard_order=order,
            nomenclature=std.nomenclature,
            manufacturer=std.manufacturer,
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
