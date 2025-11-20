import logging
import os
import re
import secrets
import string
import uuid
from datetime import date, datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

import aiofiles
import pandas as pd
from fastapi import BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import desc, func, select, not_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

# Core Service Imports
from backend.core.config import settings
from backend.core.email import (
    send_existing_user_notification_email,
    send_new_user_invitation_email,
    send_multiple_user_notification_email
)
from backend.core.security import create_invitation_token, hash_password

# Model and Schema imports
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.invitations import Invitation
from backend.models.users import User
from backend.schemas.inward_schemas import DraftResponse, InwardCreate, InwardUpdate

# Service imports
from backend.services.delayed_email_services import DelayedEmailService
from backend.services.srf_services import SrfService

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIRECTORY = BASE_DIR / "uploads" / "inward_photos"
UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

class InwardService:
    def __init__(self, db: Session):
        self.db = db

    # === Utility Methods ===
    def generate_temp_password(self, length: int = 12) -> str:
        characters = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(characters) for _ in range(length))

    def _sanitize_excel_value(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value
        return value

    def _sanitize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {key: self._sanitize_excel_value(value) for key, value in row.items()}

    def _sanitize_sheet_title(self, value: str, fallback: Optional[str] = None) -> str:
        sanitized = re.sub(r'[\\/*?:\[\]]', '_', value).strip(" _")
        return (sanitized or fallback or "Sheet")[:31]

    def _make_sheet_label(self, inward: Inward) -> str:
        base = f"SRF_{inward.srf_no}" if inward.srf_no else f"Inward_{inward.inward_id}"
        return self._sanitize_sheet_title(str(base), fallback=f"Inward_{inward.inward_id}")

    def _ensure_unique_sheet_name(self, base_name: str, existing_names: Set[str]) -> str:
        candidate = base_name[:31]
        if candidate not in existing_names:
            existing_names.add(candidate)
            return candidate
        for index in range(1, 500):
            suffix = f"_{index}"
            trimmed = base_name[: 31 - len(suffix)]
            candidate = f"{trimmed}{suffix}"
            if candidate not in existing_names:
                existing_names.add(candidate)
                return candidate
        raise HTTPException(status_code=500, detail="Unable to generate a unique sheet name.")

    def _bool_to_text(self, value: Optional[bool]) -> Optional[str]:
        if value is True: return "Yes"
        if value is False: return "No"
        return None

    def _build_inward_export_rows(self, inward: Inward) -> Tuple[str, List[Dict[str, Any]]]:
        customer_details = inward.customer.customer_details if inward.customer else inward.customer_details
        srf = inward.srf
        receiver_name = inward.received_by if inward.received_by else "N/A"

        base_row = self._sanitize_row({
            "Inward ID": inward.inward_id, "SRF No": str(inward.srf_no), "Customer": customer_details,
            "Status": inward.status, "Received By": receiver_name, "Material Inward Date": inward.material_inward_date,
            "Customer DC No": inward.customer_dc_no, "Customer DC Date": inward.customer_dc_date,
            "Updated At": inward.updated_at,
            "Calibration Frequency": getattr(srf, "calibration_frequency", None),
            "Statement Of Conformity": self._bool_to_text(getattr(srf, "statement_of_conformity", None)),
            "Decision Rule - ISO/IS Doc": self._bool_to_text(getattr(srf, "ref_iso_is_doc", None)),
            "Decision Rule - Manufacturer Manual": self._bool_to_text(getattr(srf, "ref_manufacturer_manual", None)),
            "Decision Rule - Customer Requirement": self._bool_to_text(getattr(srf, "ref_customer_requirement", None)),
            "Turnaround Time (Days)": getattr(srf, "turnaround_time", None),
            "Special Remarks": getattr(srf, "remarks", None),
        })
        rows: List[Dict[str, Any]] = []
        srf_equipment_map: Dict[int, Any] = {
            srf_eqp.inward_eqp_id: srf_eqp for srf_eqp in (srf.equipments or []) if srf_eqp.inward_eqp_id
        }
        
        equipment_items = sorted(inward.equipments, key=lambda eq: eq.nepl_id) if inward.equipments else []

        if equipment_items:
            for index, equipment in enumerate(equipment_items, start=1):
                srf_equipment = srf_equipment_map.get(getattr(equipment, "inward_eqp_id", None))
                rows.append(self._sanitize_row({
                    **base_row, "Equipment Row": index, "Equipment NEPL ID": equipment.nepl_id,
                    "Material Description": equipment.material_description, "Make": equipment.make,
                    "Model": equipment.model, "Range": equipment.range, "Serial No": equipment.serial_no,
                    "Quantity": equipment.quantity, "Inspection Notes": equipment.visual_inspection_notes,
                    "Calibration By": equipment.calibration_by, "Supplier": equipment.supplier,
                    "Out DC": equipment.out_dc, "In DC": equipment.in_dc,
                    "Nextage Reference": equipment.nextage_contract_reference,
                    "Accessories Included": equipment.accessories_included,
                    "Engineer Remark / Decision": equipment.engineer_remarks,
                    "Customer Remark": equipment.customer_remarks,
                    "Equipment Unit": getattr(srf_equipment, "unit", None),
                    "Calibration Points": getattr(srf_equipment, "no_of_calibration_points", None),
                    "Mode of Calibration": getattr(srf_equipment, "mode_of_calibration", None),
                }))
        else:
            rows.append(self._sanitize_row({**base_row, "Equipment Row": 1}))
        return self._make_sheet_label(inward), rows

    # === Draft Handling ===
    async def get_user_drafts(self, user_id: int) -> List[DraftResponse]:
        drafts = self.db.scalars(
            select(Inward)
            .where(Inward.created_by == user_id, Inward.is_draft == True)
            .order_by(desc(Inward.draft_updated_at))
        ).all()
        return [DraftResponse.model_validate(d) for d in drafts]

    async def get_draft_by_id(self, draft_id: int, user_id: int) -> DraftResponse:
        draft = self.db.scalars(
            select(Inward).where(
                Inward.inward_id == draft_id,
                Inward.created_by == user_id,
                Inward.is_draft == True
            )
        ).first()
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found or access denied")
        return DraftResponse.model_validate(draft)

    async def save_draft_files(self, files_by_index: Dict[int, List[UploadFile]]) -> Dict[int, List[str]]:
        saved_paths: Dict[int, List[str]] = {}
        for index, files in files_by_index.items():
            paths_for_index: List[str] = []
            for file in files:
                if not file or not getattr(file, "filename", None):
                    continue
                unique_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
                file_path = UPLOAD_DIRECTORY / unique_filename
                await file.seek(0)
                async with aiofiles.open(str(file_path), 'wb') as out_file:
                    await out_file.write(await file.read())
                relative_path = os.path.relpath(file_path, BASE_DIR).replace("\\", "/")
                paths_for_index.append(relative_path)
            if paths_for_index:
                saved_paths[index] = paths_for_index
        return saved_paths

    async def update_draft(self, user_id: int, inward_id: Optional[int], draft_data: Dict[str, Any]) -> DraftResponse:
        try:
            current_time = datetime.now(timezone.utc)
            
            material_date = draft_data.get('material_inward_date') or draft_data.get('date')
            
            # --- FIXED: Handle SRF No for Drafts to prevent using real numbers or constraint errors ---
            incoming_srf = draft_data.get('srf_no')
            
            # If SRF is TBD, Loading, or Missing, assign a temp DRAFT ID
            if not incoming_srf or incoming_srf in ['TBD', 'Loading...', 'Error!']:
                if inward_id:
                     # If updating an existing draft, check if it already has a DRAFT-xxx ID
                    existing_draft = self.db.get(Inward, inward_id)
                    srf_to_save = existing_draft.srf_no if existing_draft else f"DRAFT-{uuid.uuid4().hex[:8]}"
                else:
                    # New draft, assign temp ID
                    srf_to_save = f"DRAFT-{uuid.uuid4().hex[:8]}"
            else:
                # If user somehow has a specific number (rare for new flow), use it
                srf_to_save = incoming_srf
            # ----------------------------------------------------------------------------------------

            if inward_id:
                draft = self.db.get(Inward, inward_id)
                if not draft or draft.created_by != user_id or not draft.is_draft:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft not found or access denied")
                
                draft.srf_no = srf_to_save
                draft.customer_id = draft_data.get('customer_id')
                draft.material_inward_date = material_date or draft.material_inward_date
                draft.customer_dc_date = draft_data.get('customer_dc_date')
                draft.customer_dc_no = draft_data.get('customer_dc_no')
                draft.received_by = draft_data.get('receiver')
                draft.draft_data = draft_data
                draft.draft_updated_at = current_time
            else:
                draft = Inward(
                    created_by=user_id, status='draft', is_draft=True,
                    draft_updated_at=current_time, draft_data=draft_data,
                    srf_no=srf_to_save,
                    customer_id=draft_data.get('customer_id'),
                    material_inward_date=material_date,
                    customer_dc_date=draft_data.get('customer_dc_date'),
                    customer_dc_no=draft_data.get('customer_dc_no'),
                    received_by=draft_data.get('receiver'),
                )
                self.db.add(draft)

            self.db.commit()
            self.db.refresh(draft)
            return DraftResponse.model_validate(draft)
        except IntegrityError as e:
            self.db.rollback()
            logger.warning(f"Draft save failed due to a data conflict: {e.orig}")
            if 'violates not-null constraint' in str(e.orig):
                 raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"A required field (likely Material Inward Date) was missing. Error: {e.orig}")
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Data conflict. The SRF Number may already be in use.")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to save draft due to an unexpected error: {e}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An internal server error occurred while saving the draft.")

    async def delete_draft(self, draft_id: int, user_id: int) -> bool:
        draft = self.db.scalars(select(Inward).where(Inward.inward_id == draft_id, Inward.created_by == user_id, Inward.is_draft == True)).first()
        if not draft: return False
        self.db.delete(draft)
        self.db.commit()
        return True

    # === Core Inward Logic ===
    async def submit_inward(
        self,
        inward_data: InwardCreate,
        files_by_index: Dict[int, List[UploadFile]],
        user_id: int,
        draft_inward_id: Optional[int] = None,
        customer_details_value: Optional[str] = None
    ) -> Inward:
        # Generates the REAL, authoritative number only on final submit
        authoritative_srf_no = SrfService(self.db).generate_next_srf_no()
        try:
            customer_details = getattr(inward_data, "customer_details", customer_details_value)
            
            if draft_inward_id:
                self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == draft_inward_id).delete(synchronize_session=False)
                db_inward = self.db.get(Inward, draft_inward_id)
                if not db_inward or db_inward.created_by != user_id or not db_inward.is_draft:
                    raise HTTPException(status_code=404, detail="Draft not found or access denied.")
                
                # Overwrite temporary DRAFT ID with real SRF ID
                db_inward.srf_no = authoritative_srf_no
                db_inward.material_inward_date = inward_data.material_inward_date
                db_inward.customer_dc_date = inward_data.customer_dc_date
                db_inward.customer_dc_no = inward_data.customer_dc_no
                db_inward.customer_id = inward_data.customer_id
                db_inward.customer_details = customer_details
                db_inward.received_by = inward_data.receiver
                db_inward.is_draft = False
                db_inward.draft_data = None
                db_inward.draft_updated_at = None
                db_inward.updated_by = user_id
                db_inward.updated_at = datetime.now(timezone.utc)
            else:
                db_inward = Inward(
                    srf_no=authoritative_srf_no,
                    material_inward_date=inward_data.material_inward_date,
                    customer_dc_date=inward_data.customer_dc_date,
                    customer_dc_no=inward_data.customer_dc_no,
                    customer_id=inward_data.customer_id,
                    customer_details=customer_details,
                    received_by=inward_data.receiver,
                    created_by=user_id,
                    is_draft=False
                )
                self.db.add(db_inward)
                self.db.flush()

            await self._process_equipment_list(db_inward.inward_id, inward_data.equipment_list, files_by_index)
            db_inward.status = 'created'
            self.db.commit()
            self.db.refresh(db_inward)
            return db_inward
        except IntegrityError as e:
            self.db.rollback()
            if 'srf_no' in str(e.orig) and 'violates unique constraint' in str(e.orig):
                logger.error(f"SRF number collision during submit: {authoritative_srf_no}. Error: {e}", exc_info=True)
                raise HTTPException(status_code=409, detail=f"A conflict occurred with SRF number '{authoritative_srf_no}'. Please try again.")
            logger.error(f"Integrity error in submit_inward: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Database integrity error during submission.")
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error in submit_inward: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="An unexpected error occurred during submission.")

    async def update_inward_with_files(self, inward_id: int, inward_data: InwardUpdate, files_by_index: Dict[int, List[UploadFile]], updater_id: int) -> Inward:
        try:
            db_inward = self.db.get(Inward, inward_id)
            if not db_inward: raise HTTPException(status_code=404, detail="Inward record not found.")

            self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == inward_id).delete(synchronize_session=False)

            db_inward.material_inward_date = inward_data.material_inward_date
            db_inward.customer_dc_date = inward_data.customer_dc_date
            db_inward.customer_dc_no = inward_data.customer_dc_no
            db_inward.customer_id = inward_data.customer_id
            db_inward.customer_details = inward_data.customer_details
            db_inward.received_by = inward_data.receiver
            db_inward.updated_by = updater_id
            db_inward.updated_at = datetime.now(timezone.utc)
            if db_inward.status == 'reviewed': db_inward.status = 'updated'

            await self._process_equipment_list(inward_id, inward_data.equipment_list, files_by_index)

            self.db.commit()
            self.db.refresh(db_inward)
            return db_inward
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating inward {inward_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Error while updating.")

    async def _process_equipment_list(self, inward_id: int, equipment_list: List, files_by_index: Dict[int, List[UploadFile]]):
        inward_record = self.db.get(Inward, inward_id)
        if not inward_record:
            raise Exception(f"Inward record with ID {inward_id} not found.")
        
        authoritative_srf_no = inward_record.srf_no
        
        equipment_models = []
        for index, eqp_model in enumerate(equipment_list):
            existing_photos = getattr(eqp_model, "existing_photo_urls", []) or []
            photo_paths = [str(p).replace("\\", "/") for p in existing_photos if isinstance(p, str) and p.strip()]
            
            if index in files_by_index:
                for file in files_by_index[index]:
                    if file and file.filename:
                        unique_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1]}"
                        file_path = UPLOAD_DIRECTORY / unique_filename
                        await file.seek(0)
                        async with aiofiles.open(str(file_path), 'wb') as out_file:
                            await out_file.write(await file.read())
                        photo_paths.append(os.path.relpath(file_path, BASE_DIR).replace("\\", "/"))

            authoritative_nepl_id = f"{authoritative_srf_no}-{index + 1}"

            db_equipment = InwardEquipment(
                inward_id=inward_id,
                nepl_id=authoritative_nepl_id,
                material_description=eqp_model.material_desc,
                make=eqp_model.make, model=eqp_model.model, range=eqp_model.range,
                serial_no=eqp_model.serial_no, quantity=eqp_model.qty,
                visual_inspection_notes=eqp_model.inspe_notes or "OK",
                calibration_by=eqp_model.calibration_by,
                supplier=eqp_model.supplier, out_dc=eqp_model.out_dc, in_dc=eqp_model.in_dc,
                nextage_contract_reference=eqp_model.nextage_ref,
                accessories_included=eqp_model.accessories_included,
                qr_code=eqp_model.qr_code, barcode=eqp_model.barcode,
                photos=photo_paths,
                engineer_remarks=eqp_model.engineer_remarks,
                customer_remarks=None
            )
            equipment_models.append(db_equipment)
        if equipment_models:
            self.db.add_all(equipment_models)

    # === Retrieval Methods ===
    async def get_all_inwards(self, status: Optional[str] = None) -> List[Inward]:
        query = self.db.query(Inward).options(joinedload(Inward.customer), joinedload(Inward.equipments)).filter(Inward.is_draft.is_(False))
        if status:
            query = query.filter(Inward.status == status)
        return query.order_by(Inward.created_at.desc()).all()

    async def get_inward_by_id(self, inward_id: int) -> Inward:
        db_inward = self.db.query(Inward).options(joinedload(Inward.customer), joinedload(Inward.equipments)).filter(Inward.inward_id == inward_id).first()
        if not db_inward or db_inward.is_draft: raise HTTPException(status_code=404, detail="Inward record not found.")
        return db_inward

    async def get_inwards_for_export(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        try:
            from backend.models.srfs import Srf
            stmt = select(Inward).options(selectinload(Inward.customer), selectinload(Inward.equipments), joinedload(Inward.srf)).where(Inward.is_draft.is_(False))
            if start_date: stmt = stmt.where(func.date(Inward.created_at) >= start_date)
            if end_date: stmt = stmt.where(func.date(Inward.created_at) <= end_date)
            stmt = stmt.order_by(desc(Inward.created_at))
            inwards = self.db.scalars(stmt).unique().all()
            return [
                {
                    "inward_id": i.inward_id, "srf_no": str(i.srf_no),
                    "customer_details": i.customer.customer_details if i.customer else i.customer_details,
                    "status": i.status, "received_by": i.received_by if i.received_by else 'N/A',
                    "updated_at": i.updated_at, "equipment_count": len(i.equipments or []),
                    "calibration_frequency": getattr(i.srf, "calibration_frequency", None),
                    "statement_of_conformity": getattr(i.srf, "statement_of_conformity", None),
                    "ref_iso_is_doc": getattr(i.srf, "ref_iso_is_doc", None),
                    "ref_manufacturer_manual": getattr(i.srf, "ref_manufacturer_manual", None),
                    "ref_customer_requirement": getattr(i.srf, "ref_customer_requirement", None),
                    "turnaround_time": getattr(i.srf, "turnaround_time", None),
                    "remarks": getattr(i.srf, "remarks", None),
                } for i in inwards
            ]
        except Exception as e:
            logger.error(f"Error fetching inwards for export: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve inwards for export.")

    async def get_updated_inwards(self, start_date: Optional[date] = None, end_date: Optional[date] = None) -> List[Dict[str, Any]]:
        try:
            from backend.models.srfs import Srf
            stmt = select(Inward).options(selectinload(Inward.customer), selectinload(Inward.equipments)).where(Inward.status == 'updated', Inward.is_draft.is_(False))
            exists_subquery = select(Srf.inward_id).where(Srf.inward_id == Inward.inward_id).exists()
            stmt = stmt.where(not_(exists_subquery))
            if start_date: stmt = stmt.where(func.date(Inward.updated_at) >= start_date)
            if end_date: stmt = stmt.where(func.date(Inward.updated_at) <= end_date)
            stmt = stmt.order_by(desc(Inward.updated_at))
            inwards = self.db.scalars(stmt).all()
            return [
                {
                    "inward_id": i.inward_id, "srf_no": str(i.srf_no),
                    "customer_details": (i.customer.customer_details if i.customer else i.customer_details),
                    "status": i.status, "received_by": i.received_by if i.received_by else 'N/A',
                    "updated_at": i.updated_at, "equipment_count": len(i.equipments or []),
                    "calibration_frequency": None, "statement_of_conformity": None,
                    "ref_iso_is_doc": None, "ref_manufacturer_manual": None,
                    "ref_customer_requirement": None, "turnaround_time": None, "remarks": None
                } for i in inwards
            ]
        except Exception as e:
            logger.error(f"Error fetching updated inwards (excluding those with SRF): {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve updated inwards.")

    async def generate_inward_export(self, inward_id: int) -> BytesIO:
        inward = await self.get_inward_by_id(inward_id)
        _, rows = self._build_inward_export_rows(inward)
        try:
            df = pd.DataFrame(rows)
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Inward Details")
            output.seek(0)
            return output
        except Exception as exc:
            logger.error(f"Failed to generate Excel for inward {inward_id}: {exc}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate export.")

    async def generate_multiple_inwards_export(self, inward_ids: List[int]) -> BytesIO:
        unique_ids = [i for i in sorted(list(set(i for i in inward_ids if i is not None)))]
        if not unique_ids: raise HTTPException(status_code=400, detail="Select at least one inward to export.")
        output = BytesIO()
        try:
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                sheet_names: Set[str] = set()
                all_rows: List[Dict[str, Any]] = []
                for inward_id in unique_ids:
                    inward = await self.get_inward_by_id(inward_id)
                    sheet_label, rows = self._build_inward_export_rows(inward)
                    unique_sheet_name = self._ensure_unique_sheet_name(sheet_label, sheet_names)
                    pd.DataFrame(rows).to_excel(writer, index=False, sheet_name=unique_sheet_name)
                    all_rows.extend(rows)
                if all_rows:
                    summary_title = self._sanitize_sheet_title("Selected Inwards", fallback="Selected")
                    summary_sheet_name = self._ensure_unique_sheet_name(summary_title, sheet_names)
                    pd.DataFrame(all_rows).to_excel(writer, index=False, sheet_name=summary_sheet_name)
            output.seek(0)
            return output
        except Exception as exc:
            logger.error(f"Failed to generate batch export for inwards {unique_ids}: {exc}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate export.")

    # === Customer Notification Methods ===
    async def process_customer_notification(self, inward_id: int, creator_id: int, background_tasks: BackgroundTasks, customer_emails: Optional[List[str]] = None, send_later: bool = False):
        db_inward = await self.get_inward_by_id(inward_id)
        if not db_inward.customer: raise HTTPException(status_code=400, detail="Inward is not linked to a valid customer.")
        creator = self.db.get(User, creator_id)
        created_by_name = creator.username if creator else f"user_{creator_id}"

        if send_later:
            # For scheduled emails, use the primary customer email
            primary_email = db_inward.customer.email if db_inward.customer else None
            await DelayedEmailService(self.db).schedule_delayed_email(inward_id=inward_id, recipient_email=primary_email, creator_id=creator_id, delay_minutes=settings.DELAYED_EMAIL_DELAY_MINUTES)
            self.db.commit()
            return {"message": f"FIR for SRF {db_inward.srf_no} is scheduled."}

        # Handle multiple email addresses
        if not customer_emails:
            customer_emails = [db_inward.customer.email] if db_inward.customer and db_inward.customer.email else []
        
        if not customer_emails:
            raise HTTPException(status_code=422, detail="At least one customer email is required.")

        # Send to multiple recipients
        success_count = 0
        errors = []
        
        for email in customer_emails:
            try:
                existing_user = self.db.scalars(select(User).where(User.email == email)).first()
                if existing_user:
                    await self._notify_existing_customer(db_inward, existing_user, background_tasks, created_by_name)
                    success_count += 1
                else:
                    await self._invite_new_customer(db_inward, email, creator_id, background_tasks, created_by_name)
                    success_count += 1
            except Exception as e:
                logger.error(f"Failed to send notification to {email}: {e}")
                errors.append(f"Failed to send to {email}: {str(e)}")

        if success_count > 0:
            message = f"FIR for SRF {db_inward.srf_no} sent to {success_count} recipient(s)."
            if errors:
                message += f" {len(errors)} failed: {'; '.join(errors)}"
            return {"message": message}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to send to any recipients: {'; '.join(errors)}")

    async def _notify_existing_customer(self, db_inward, existing_user, background_tasks, created_by_name):
        if existing_user.role.lower() != 'customer': raise HTTPException(status_code=400, detail="An internal staff account exists with this email.")
        if not db_inward.customer_id and existing_user.customer_id:
            db_inward.customer_id = existing_user.customer_id
            self.db.commit()

        ok = await send_existing_user_notification_email(background_tasks=background_tasks, recipient_email=existing_user.email, inward_id=db_inward.inward_id, srf_no=db_inward.srf_no, db=self.db, created_by=created_by_name, recipient_user_id=existing_user.user_id)
        if not ok: raise HTTPException(status_code=500, detail="Failed to queue notification email.")

    async def _invite_new_customer(self, db_inward, customer_email, creator_id, background_tasks, created_by_name):
        if not db_inward.customer: raise HTTPException(status_code=400, detail="Inward has no customer to invite.")
        if self.db.scalars(select(User).where(User.email == customer_email)).first(): raise HTTPException(status_code=400, detail="A user account already exists with this email.")

        temp_password = self.generate_temp_password()
        new_user = User(email=customer_email, username=customer_email, password_hash=hash_password(temp_password), role='customer', is_active=False, customer_id=db_inward.customer_id, full_name=db_inward.customer.contact_person)
        self.db.add(new_user)

        new_invitation = Invitation(email=customer_email, token=create_invitation_token(), customer_id=db_inward.customer_id, created_by=creator_id, user_role='customer', invited_name=db_inward.customer.contact_person)
        self.db.add(new_invitation)
        self.db.commit()
        self.db.refresh(new_user)

        ok = await send_new_user_invitation_email(background_tasks=background_tasks, recipient_email=customer_email, token=new_invitation.token, srf_no=db_inward.srf_no, temp_password=temp_password, db=self.db, inward_id=db_inward.inward_id, created_by=created_by_name, recipient_user_id=new_user.user_id)
        if not ok: raise HTTPException(status_code=500, detail="Failed to queue invitation email.")

    async def send_scheduled_report_now(self, task_id: int, customer_emails: List[str], background_tasks: BackgroundTasks) -> dict:
        try:
            task = await DelayedEmailService(self.db).get_task_by_id(task_id)
            if not task or task.is_sent or task.is_cancelled: raise HTTPException(status_code=404, detail="Scheduled task not found or already processed.")
            response = await self.process_customer_notification(inward_id=task.inward_id, creator_id=task.created_by, background_tasks=background_tasks, customer_emails=customer_emails, send_later=False)
            if response:
                await DelayedEmailService(self.db).mark_task_as_sent(task_id)
            return response
        except Exception as e:
            logger.error(f"Error sending scheduled report for task {task_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to send scheduled report.")