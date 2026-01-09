from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date

from backend.db import get_db
from backend.models.htw_job_standard_snapshot import HTWJobStandardSnapshot
from backend.services.htw_job_standard_selection import (
    auto_select_standards_for_job
)

router = APIRouter(
    prefix="/jobs",
    tags=["HTW – Standard Auto Selection"]
)

# =========================================================
# GET → Fetch already selected master standards
# =========================================================
@router.get("/{job_id}/auto-selected-standards")
def get_auto_selected_standards(
    job_id: int,
    db: Session = Depends(get_db)
):
    standards = (
        db.query(HTWJobStandardSnapshot)
        .filter(HTWJobStandardSnapshot.job_id == job_id)
        .order_by(HTWJobStandardSnapshot.standard_order.asc())
        .all()
    )

    if not standards:
        return {
            "exists": False,
            "standards": []
        }

    return {
        "exists": True,
        "standards": standards
    }


# =========================================================
# POST → Auto select standards (ONLY if not exists)
# =========================================================
@router.post("/{job_id}/auto-select-standards")
def auto_select_standards(
    job_id: int,
    inward_eqp_id: int,
    job_date: date,
    db: Session = Depends(get_db)
):
    existing = (
        db.query(HTWJobStandardSnapshot)
        .filter(HTWJobStandardSnapshot.job_id == job_id)
        .first()
    )

    if existing:
        return {
            "status": "already_selected",
            "message": "Master standards already selected. Use GET API to fetch them."
        }

    auto_select_standards_for_job(
        db=db,
        job_id=job_id,
        inward_eqp_id=inward_eqp_id,
        job_date=job_date
    )

    return {
        "status": "created",
        "message": "Master standards selected successfully"
    }


# =========================================================
# PUT → Recompute master standards (OPTIONAL / ADMIN)
# =========================================================
@router.put("/{job_id}/auto-select-standards")
def recompute_auto_selected_standards(
    job_id: int,
    inward_eqp_id: int,
    job_date: date,
    db: Session = Depends(get_db)
):
    db.query(HTWJobStandardSnapshot)\
        .filter(HTWJobStandardSnapshot.job_id == job_id)\
        .delete()
    db.flush()

    auto_select_standards_for_job(
        db=db,
        job_id=job_id,
        inward_eqp_id=inward_eqp_id,
        job_date=job_date
    )

    return {
        "status": "recomputed",
        "message": "Master standards re-selected successfully"
    }
