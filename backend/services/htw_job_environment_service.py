# backend/services/htw_job_environment_service.py
import logging
from typing import Optional, List
from decimal import Decimal

from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from fastapi import HTTPException, status

from backend.models.htw_job_environment import HTWJobEnvironment
from backend.schemas.htw_job_environment_schemas import (
    HTWJobEnvironmentCreate,
    HTWJobEnvironmentValidationResponse,
)

logger = logging.getLogger(__name__)

# FR-11 limits
TEMP_MIN = Decimal("22.0")
TEMP_MAX = Decimal("24.0")
HUMIDITY_MIN = Decimal("50.0")
HUMIDITY_MAX = Decimal("70.0")


class HTWJobEnvironmentService:
    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------
    # Validation (pure business logic)
    # ------------------------------------------------------------
    def validate_environment_values(
        self,
        temperature: Decimal,
        humidity: Decimal,
    ) -> HTWJobEnvironmentValidationResponse:
        warnings: List[str] = []

        if temperature <= 0:
            warnings.append(f"Temperature value ({temperature} °C) is zero or negative")
        if humidity <= 0:
            warnings.append(f"Humidity value ({humidity} %) is zero or negative")

        is_temperature_in_range = TEMP_MIN <= temperature <= TEMP_MAX
        is_humidity_in_range = HUMIDITY_MIN <= humidity <= HUMIDITY_MAX
        is_valid = is_temperature_in_range and is_humidity_in_range

        return HTWJobEnvironmentValidationResponse(
            is_temperature_in_range=is_temperature_in_range,
            is_humidity_in_range=is_humidity_in_range,
            is_valid=is_valid,
            warnings=warnings,
            blocks_job_flow=not is_valid,
        )

    # ------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------
    def _get_by_job_and_stage(
        self,
        job_id: int,
        stage: str,
    ) -> Optional[HTWJobEnvironment]:
        return (
            self.db.query(HTWJobEnvironment)
            .filter(
                HTWJobEnvironment.job_id == job_id,
                HTWJobEnvironment.condition_stage == stage,
            )
            .first()
        )

    # ------------------------------------------------------------
    # CREATE
    # ------------------------------------------------------------
    def create_environment(
        self,
        job_id: int,
        payload: HTWJobEnvironmentCreate,
    ):
        # POST requires PRE
        if payload.condition_stage == "POST":
            if not self._get_by_job_and_stage(job_id, "PRE"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="POST environment cannot be recorded before PRE",
                )

        # Prevent duplicate PRE / POST
        if self._get_by_job_and_stage(job_id, payload.condition_stage):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{payload.condition_stage} environment already exists for this job",
            )

        # Validate values
        validation = self.validate_environment_values(
            payload.ambient_temperature,
            payload.relative_humidity,
        )

        # Block save if invalid
        if not validation.is_valid:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": "Environmental values are outside the acceptable range",
                    "validation": validation.model_dump(),
                },
            )

        try:
            record = HTWJobEnvironment(
                job_id=job_id,
                condition_stage=payload.condition_stage,
                ambient_temperature=payload.ambient_temperature,
                temperature_unit=payload.temperature_unit,
                relative_humidity=payload.relative_humidity,
                humidity_unit=payload.humidity_unit,
            )

            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)

            return record, validation

        except IntegrityError as e:
            self.db.rollback()
            msg = str(e.orig).lower()

            if "unique" in msg:
                detail = f"{payload.condition_stage} environment already exists for this job"
                code = status.HTTP_409_CONFLICT
            elif "foreign key" in msg:
                detail = f"Job ID {job_id} does not exist"
                code = status.HTTP_400_BAD_REQUEST
            else:
                detail = "Integrity constraint violation"
                code = status.HTTP_400_BAD_REQUEST

            raise HTTPException(status_code=code, detail=detail)

        except SQLAlchemyError:
            self.db.rollback()
            logger.exception("Database error while creating environment")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database error while creating environment record",
            )

    # ------------------------------------------------------------
    # READ
    # ------------------------------------------------------------
    def get_environment_by_job(
        self,
        job_id: int,
        stage: Optional[str] = None,
    ) -> List[HTWJobEnvironment]:
        query = self.db.query(HTWJobEnvironment).filter(
            HTWJobEnvironment.job_id == job_id
        )

        if stage:
            query = query.filter(HTWJobEnvironment.condition_stage == stage)

        return query.order_by(HTWJobEnvironment.recorded_at.desc()).all()
