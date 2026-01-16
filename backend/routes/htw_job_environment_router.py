import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.db import get_db
from backend.schemas.htw_job_environment_schemas import (
    HTWJobEnvironmentCreate,
    HTWJobEnvironmentResponse,
)
from backend.services.htw_job_environment_service import HTWJobEnvironmentService

logger = logging.getLogger(__name__)

# --- FIX: Removed "/api" from here because main.py already adds it ---
router = APIRouter(
    prefix="/staff/jobs", 
    tags=["HTW Job Environment"],
)

# ---------------------------------------------------------------------
# CREATE: PRE / POST
# ---------------------------------------------------------------------
@router.post(
    "/{job_id}/environment",
    response_model=HTWJobEnvironmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_environment(
    job_id: int,
    payload: HTWJobEnvironmentCreate,
    db: Session = Depends(get_db),
):
    service = HTWJobEnvironmentService(db)
    record, validation = service.create_environment(job_id, payload)

    return {
        "data": record,
        "validation": validation,
    }


# ---------------------------------------------------------------------
# READ: Environment records for a job
# ---------------------------------------------------------------------
@router.get(
    "/{job_id}/environment",
    response_model=List[HTWJobEnvironmentResponse],
)
def get_environment_by_job(
    job_id: int,
    condition_stage: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    service = HTWJobEnvironmentService(db)
    records = service.get_environment_by_job(job_id, condition_stage)

    response = []
    for record in records:
        validation = service.validate_environment_values(
            record.ambient_temperature,
            record.relative_humidity,
        )
        response.append(
            {
                "data": record,
                "validation": validation,
            }
        )

    return response


# ---------------------------------------------------------------------
# PRE status gate
# ---------------------------------------------------------------------
@router.get("/{job_id}/environment/pre-status")
def get_pre_status(job_id: int, db: Session = Depends(get_db)):
    service = HTWJobEnvironmentService(db)
    pre = service._get_by_job_and_stage(job_id, "PRE")

    if not pre:
        return {
            "pre_exists": False,
            "pre_is_valid": False,
            "calibration_can_proceed": False,
        }

    validation = service.validate_environment_values(
        pre.ambient_temperature,
        pre.relative_humidity,
    )

    return {
        "pre_exists": True,
        "pre_is_valid": validation.is_valid,
        "calibration_can_proceed": validation.is_valid,
    }


# ---------------------------------------------------------------------
# POST status gate
# ---------------------------------------------------------------------
@router.get("/{job_id}/environment/post-status")
def get_post_status(job_id: int, db: Session = Depends(get_db)):
    service = HTWJobEnvironmentService(db)
    post = service._get_by_job_and_stage(job_id, "POST")

    if not post:
        return {
            "post_exists": False,
            "post_is_valid": False,
            "certificate_can_be_generated": False,
        }

    validation = service.validate_environment_values(
        post.ambient_temperature,
        post.relative_humidity,
    )

    return {
        "post_exists": True,
        "post_is_valid": validation.is_valid,
        "certificate_can_be_generated": validation.is_valid,
    }