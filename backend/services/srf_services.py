import logging
from datetime import datetime
from typing import List, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload

from backend.models.customers import Customer
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.srfs import Srf
from backend.models.srf_equipments import SrfEquipment
from backend.schemas.user_schemas import User as UserSchema

logger = logging.getLogger(__name__)


class SrfService:
    def __init__(self, db: Session):
        self.db = db

    def get_pending_srf_inwards(self, current_user: UserSchema) -> List[Dict[str, Any]]:
        """
        Gets inwards that are ready for SRF creation.
        """
        allowed_statuses = ['updated']
        stmt = (
            select(Inward)
            .options(selectinload(Inward.equipments))
            .where(Inward.status.in_(allowed_statuses))
            .order_by(Inward.updated_at.desc())
        )

        inwards = self.db.scalars(stmt).all()

        result = [
            {
                "inward_id": inward.inward_id,
                "srf_no": inward.srf_no,
                "date": inward.date,
                "customer_details": inward.customer_details,
                "status": inward.status,
                "equipment_count": len(inward.equipments),
                "equipments": [
                    {
                        "inward_eqp_id": eq.inward_eqp_id,
                        "material_description": eq.material_description,
                        "model": eq.model,
                        "serial_no": eq.serial_no
                    }
                    for eq in inward.equipments
                ]
            }
            for inward in inwards
        ]

        return result

    def create_srf_from_inward(self, inward_id: int, srf_data: Dict[str, Any]) -> Srf:
        """
        Creates a new SRF from a pending inward and updates the inward's status.
        """
        inward = self.db.get(Inward, inward_id)
        if not inward:
            raise HTTPException(status_code=404, detail="Inward not found")

        allowed_statuses = ['updated']
        if inward.status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"An SRF can only be created from an inward with status: {', '.join(allowed_statuses)}."
            )

        existing_srf = self.db.scalars(select(Srf).where(Srf.inward_id == inward_id)).first()
        if existing_srf:
            raise HTTPException(status_code=409, detail="SRF already exists for this inward. Please refresh the list.")

        customer = self.db.get(Customer, inward.customer_id)
        if not customer:
            raise HTTPException(status_code=400, detail="Associated customer not found for this inward.")

        new_srf = Srf(
            inward_id=inward_id,
            srf_no=inward.srf_no,
            date=srf_data.get('date', inward.date),
            certificate_issue_name=srf_data.get('certificate_issue_name', customer.customer_details),
            status='created'
        )
        self.db.add(new_srf)
        self.db.flush()

        inward_equipments = self.db.scalars(
            select(InwardEquipment).where(InwardEquipment.inward_id == inward_id)
        ).all()

        equipment_payload_list = srf_data.get('equipments', [])
        for inward_eq in inward_equipments:
            eq_payload = next((item for item in equipment_payload_list if item.get('inward_eqp_id') == inward_eq.inward_eqp_id), {})

            srf_eq = SrfEquipment(
                srf_id=new_srf.srf_id,
                inward_eqp_id=inward_eq.inward_eqp_id,
                unit=eq_payload.get('unit'),
                no_of_calibration_points=eq_payload.get('no_of_calibration_points'),
                mode_of_calibration=eq_payload.get('mode_of_calibration')
            )
            self.db.add(srf_eq)

        self.db.commit()
        self.db.refresh(new_srf)
        return new_srf

    def get_srf_by_id(self, srf_id: int) -> Srf:
        srf = self.db.scalars(
            select(Srf)
            .options(
                selectinload(Srf.inward).selectinload(Inward.customer),
                selectinload(Srf.equipments).selectinload(SrfEquipment.inward_equipment)
            )
            .where(Srf.srf_id == srf_id)
        ).first()

        if not srf:
            raise HTTPException(status_code=404, detail="SRF not found")

        return srf

    def update_srf(self, srf_id: int, update_data: Dict[str, Any]):
        srf = self.db.get(Srf, srf_id)
        if not srf:
            raise HTTPException(status_code=404, detail="SRF not found")

        updatable_fields = [
            "nepl_srf_no", "certificate_issue_name", "status",
            "calibration_frequency", "statement_of_conformity",
            "ref_iso_is_doc", "ref_manufacturer_manual",
            "ref_customer_requirement", "turnaround_time", "remarks"
        ]
        for field, value in update_data.items():
            if field in updatable_fields and hasattr(srf, field):
                setattr(srf, field, value)

        equipment_details_payload = update_data.get('equipment_details')
        if equipment_details_payload:
            srf_equipments_map = {
                eq.inward_eqp_id: eq
                for eq in self.db.scalars(
                    select(SrfEquipment).where(SrfEquipment.srf_id == srf_id)
                ).all()
            }
            for details in equipment_details_payload:
                inward_eqp_id = details.get("inward_eqp_id")
                if inward_eqp_id is None: continue

                srf_eq = srf_equipments_map.get(inward_eqp_id)
                if srf_eq:
                    srf_eq.unit = details.get('unit', srf_eq.unit)
                    srf_eq.no_of_calibration_points = details.get('no_of_calibration_points', srf_eq.no_of_calibration_points)
                    srf_eq.mode_of_calibration = details.get('mode_of_calibration', srf_eq.mode_of_calibration)

        self.db.commit()
        self.db.refresh(srf)
        return srf

    def generate_next_srf_no(self) -> str:
        """
        Generate the next SRF number in format NEPL25001.
        Uses both tables to find the true maximum to avoid skipping or collisions.
        Strictly EXCLUDES drafts from calculation.
        """
        try:
            current_year = datetime.now().year
            year_suffix = str(current_year)[-2:]  # e.g., "25"
            prefix = f"NEPL{year_suffix}"
            year_pattern = f"{prefix}%"

            # 1. Check Inward table - IMPORTANT: Exclude Drafts
            latest_inward_srf = self.db.scalars(
                select(Inward.srf_no)
                .where(
                    Inward.srf_no.like(year_pattern),
                    Inward.is_draft.is_(False)  # <--- CRITICAL FIX: Ignore drafts
                )
                .order_by(desc(Inward.srf_no))
            ).first()

            # 2. Check SRF table
            latest_srf_table_no = self.db.scalars(
                select(Srf.nepl_srf_no)
                .where(Srf.nepl_srf_no.like(year_pattern))
                .order_by(desc(Srf.nepl_srf_no))
            ).first()

            def extract_sequence(srf_str: str | None) -> int:
                if not srf_str:
                    return 0
                try:
                    srf_str = str(srf_str).strip()
                    if srf_str.startswith(prefix):
                        # Only extract if the length is correct to avoid parsing "NEPL25ABC"
                        numeric_part = srf_str[len(prefix):]
                        if numeric_part.isdigit():
                            return int(numeric_part)
                    return 0
                except (ValueError, AttributeError):
                    return 0

            max_inward = extract_sequence(latest_inward_srf)
            max_srf = extract_sequence(latest_srf_table_no)

            # Take the highest number found
            current_max = max(max_inward, max_srf)
            next_number = current_max + 1

            next_srf_no = f"{prefix}{next_number:03d}"

            logger.info(f"Generated SRF: {next_srf_no} (Inward Max: {max_inward}, SRF Max: {max_srf})")
            return next_srf_no

        except Exception as e:
            logger.error(f"Error generating SRF number: {e}", exc_info=True)
            timestamp = datetime.now().strftime("%y%m%d%H%M")
            return f"NEPL{timestamp}"