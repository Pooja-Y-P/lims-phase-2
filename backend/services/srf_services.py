import logging
import re
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from io import BytesIO

import pandas as pd
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select, and_
from sqlalchemy.orm import Session, selectinload, joinedload

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
        Gets list of items for the 'Pending SRF' section.
        Merges two specific scenarios:
        1. Fresh Inwards: Status is 'updated' and NO SRF exists.
        2. Draft SRFs: SRF exists and status is 'draft'.
        """
        result_map = {} # Use a dict to prevent duplicates by inward_id

        # --- Query 1: Get Draft SRFs (Resume Work) ---
        # We query SRFs directly to ensure we definitely get drafts
        draft_srfs = self.db.scalars(
            select(Srf)
            .options(
                selectinload(Srf.inward).selectinload(Inward.equipments)
            )
            .where(Srf.status == 'draft')
        ).all()

        for srf in draft_srfs:
            if srf.inward:
                result_map[srf.inward.inward_id] = {
                    "inward_id": srf.inward.inward_id,
                    "srf_no": srf.inward.srf_no,
                    "date": srf.inward.date,
                    "customer_details": srf.inward.customer_details,
                    "status": 'draft', # Force status to 'draft' for frontend logic
                    "srf_id": srf.srf_id, # Frontend needs this to open Edit Page
                    "equipment_count": len(srf.inward.equipments),
                    "equipments": [
                        {
                            "inward_eqp_id": eq.inward_eqp_id,
                            "material_description": eq.material_description,
                            "model": eq.model,
                            "serial_no": eq.serial_no
                        }
                        for eq in srf.inward.equipments
                    ]
                }

        # --- Query 2: Get Fresh Inwards (Create New) ---
        # Status must be 'updated' AND inward_id must NOT be in the SRF table
        
        # Subquery: Get all inward_ids that already have an SRF
        existing_srf_subquery = select(Srf.inward_id)

        fresh_inwards = self.db.scalars(
            select(Inward)
            .options(selectinload(Inward.equipments))
            .where(
                Inward.status == 'updated',
                Inward.inward_id.not_in(existing_srf_subquery)
            )
            .order_by(Inward.updated_at.desc())
        ).all()

        for inward in fresh_inwards:
            # Only add if not already added by the Draft loop (safety check)
            if inward.inward_id not in result_map:
                result_map[inward.inward_id] = {
                    "inward_id": inward.inward_id,
                    "srf_no": inward.srf_no,
                    "date": inward.date,
                    "customer_details": inward.customer_details,
                    "status": inward.status, # Will be 'updated'
                    "srf_id": None, # Indicates New Creation
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

        # Convert dict back to list and sort by ID desc (newest first)
        final_list = list(result_map.values())
        final_list.sort(key=lambda x: x['inward_id'], reverse=True)
        
        return final_list

    def create_srf_from_inward(self, inward_id: int, srf_data: Dict[str, Any]) -> Srf:
        """
        Handles the 'Create SRF' action.
        1. If a Draft SRF already exists, return it (Resume).
        2. If no SRF exists, create a new one (Create).
        """
        inward = self.db.get(Inward, inward_id)
        if not inward:
            raise HTTPException(status_code=404, detail="Inward not found")

        # Check if SRF exists first
        existing_srf = self.db.scalars(select(Srf).where(Srf.inward_id == inward_id)).first()
        
        if existing_srf:
            # If it's a draft, simply return it so the frontend can navigate to the Edit page
            if existing_srf.status == 'draft':
                return existing_srf
            else:
                # If it's already created/approved/rejected, block duplicate creation
                raise HTTPException(status_code=409, detail=f"SRF already exists with status '{existing_srf.status}'.")

        # If no SRF exists, ensure the Inward is in the correct state to start
        allowed_statuses = ['updated']
        if inward.status not in allowed_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"An SRF can only be created from an inward with status: {', '.join(allowed_statuses)}."
            )

        customer = self.db.get(Customer, inward.customer_id)
        
        # Extract integer from inward.srf_no string
        srf_no_int = 0
        if inward.srf_no:
            digits = re.findall(r'\d+', str(inward.srf_no))
            if digits:
                srf_no_int = int("".join(digits))

        srf_string_id = str(inward.srf_no)

        # Create new SRF record
        new_srf = Srf(
            inward_id=inward_id,
            srf_no=srf_no_int,
            nepl_srf_no=srf_string_id,
            date=srf_data.get('date', inward.material_inward_date),
            telephone=srf_data.get('telephone'),
            contact_person=srf_data.get('contact_person'),
            email=srf_data.get('email'),
            certificate_issue_name=srf_data.get('certificate_issue_name', customer.customer_details if customer else ""),
            status='created' # Initial status
        )
        self.db.add(new_srf)
        self.db.flush()

        # Map Inward Equipment to SRF Equipment
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
                no_of_calibration_points=str(eq_payload.get('no_of_calibration_points', '')),
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
                selectinload(Srf.inward).options(
                    selectinload(Inward.customer),
                    selectinload(Inward.equipments).selectinload(InwardEquipment.srf_equipment)
                )
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
            "telephone", "email", "contact_person",
            "certificate_issue_adress",
            "calibration_frequency", "statement_of_conformity",
            "ref_iso_is_doc", "ref_manufacturer_manual",
            "ref_customer_requirement", "turnaround_time", "remarks"
        ]
        for field in updatable_fields:
            if field in update_data:
                setattr(srf, field, update_data[field])

        equipment_details_payload = update_data.get('equipments')
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
                    if 'unit' in details: srf_eq.unit = details['unit']
                    if 'no_of_calibration_points' in details: 
                        srf_eq.no_of_calibration_points = str(details['no_of_calibration_points'])
                    if 'mode_of_calibration' in details: 
                        srf_eq.mode_of_calibration = details['mode_of_calibration']
                else:
                    new_srf_eq = SrfEquipment(
                        srf_id=srf_id,
                        inward_eqp_id=inward_eqp_id,
                        unit=details.get('unit'),
                        no_of_calibration_points=str(details.get('no_of_calibration_points', '')),
                        mode_of_calibration=details.get('mode_of_calibration')
                    )
                    self.db.add(new_srf_eq)

        self.db.commit()
        self.db.refresh(srf)
        return self.get_srf_by_id(srf_id)

    def generate_next_srf_no(self) -> str:
        try:
            current_year = datetime.now().year
            year_suffix = str(current_year)[-2:]
            prefix = f"NEPL{year_suffix}"
            year_pattern = f"{prefix}%"

            latest_inward_srf = self.db.scalars(
                select(Inward.srf_no)
                .where(
                    Inward.srf_no.like(year_pattern),
                    Inward.is_draft.is_(False)
                )
                .order_by(desc(Inward.srf_no))
            ).first()

            def extract_sequence(srf_str: str | None) -> int:
                if not srf_str:
                    return 0
                try:
                    srf_str = str(srf_str).strip()
                    if srf_str.startswith(prefix):
                        numeric_part = srf_str[len(prefix):]
                        if numeric_part.isdigit():
                            return int(numeric_part)
                    return 0
                except (ValueError, AttributeError):
                    return 0

            max_inward = extract_sequence(latest_inward_srf)
            next_number = max_inward + 1
            next_srf_no = f"{prefix}{next_number:03d}"

            return next_srf_no

        except Exception as e:
            logger.error(f"Error generating SRF number: {e}", exc_info=True)
            timestamp = datetime.now().strftime("%y%m%d%H%M")
            return f"NEPL{timestamp}"

    def _sanitize_excel_value(self, value: Any) -> Any:
        """Sanitize values for Excel export."""
        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value
        if isinstance(value, date):
            return value
        return value

    def _sanitize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        return {key: self._sanitize_excel_value(value) for key, value in row.items()}

    def _bool_to_text(self, value: Optional[bool]) -> Optional[str]:
        if value is True: return "Yes"
        if value is False: return "No"
        return None

    def _build_pending_srf_export_rows(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build export rows for Pending SRF Creation section."""
        rows = []
        for item in items:
            base_row = {
                "Inward ID": item.get("inward_id"),
                "SRF No": str(item.get("srf_no", "")),
                "SRF ID": item.get("srf_id"),
                "Status": item.get("status", ""),
                "Customer Name": item.get("customer_details", ""),
                "Date": item.get("date"),
                "Equipment Count": item.get("equipment_count", 0),
            }
            
            equipments = item.get("equipments", [])
            if equipments:
                for idx, eq in enumerate(equipments, 1):
                    rows.append(self._sanitize_row({
                        **base_row,
                        "Equipment Row": idx,
                        "Equipment ID": eq.get("inward_eqp_id"),
                        "Material Description": eq.get("material_description", ""),
                        "Model": eq.get("model", ""),
                        "Serial No": eq.get("serial_no", ""),
                    }))
            else:
                rows.append(self._sanitize_row(base_row))
        return rows

    def _build_srf_export_rows(self, srfs: List[Srf]) -> List[Dict[str, Any]]:
        """Build export rows for SRF data (Review, Approved, Rejected sections)."""
        rows = []
        for srf in srfs:
            inward = srf.inward
            customer = inward.customer if inward else None
            
            base_row = {
                "SRF ID": srf.srf_id,
                "SRF No": str(srf.srf_no),
                "NEPL SRF No": srf.nepl_srf_no or "",
                "Status": srf.status or "",
                "Date": srf.date,
                "Customer Name": customer.customer_details if customer else (inward.customer_details if inward else ""),
                "Contact Person": srf.contact_person or (customer.contact_person if customer else ""),
                "Email": srf.email or (customer.email if customer else ""),
                "Telephone": srf.telephone or (customer.phone if customer else ""),
                "Certificate Issue Name": srf.certificate_issue_name or "",
                "Certificate Issue Address": srf.certificate_issue_adress or "",
                "Calibration Frequency": srf.calibration_frequency or "",
                "Statement of Conformity": self._bool_to_text(srf.statement_of_conformity),
                "Ref ISO/IS Doc": self._bool_to_text(srf.ref_iso_is_doc),
                "Ref Manufacturer Manual": self._bool_to_text(srf.ref_manufacturer_manual),
                "Ref Customer Requirement": self._bool_to_text(srf.ref_customer_requirement),
                "Turnaround Time": srf.turnaround_time,
                "Remarks": srf.remarks or "",
                "SRF Created At": srf.created_at,
                "SRF Updated At": srf.updated_at,
            }
            
            if inward:
                base_row.update({
                    "Inward ID": inward.inward_id,
                    "Material Inward Date": inward.material_inward_date,
                    "Customer DC No": inward.customer_dc_no or "",
                    "Customer DC Date": inward.customer_dc_date or "",
                    "Received By": inward.received_by or "",
                })
                
                if customer:
                    base_row.update({
                        "Ship To Address": customer.ship_to_address or "",
                        "Bill To Address": customer.bill_to_address or "",
                    })
            
            equipments = inward.equipments if inward else []
            if equipments:
                for idx, eq in enumerate(equipments, 1):
                    srf_eq = eq.srf_equipment
                    rows.append(self._sanitize_row({
                        **base_row,
                        "Equipment Row": idx,
                        "Equipment ID": eq.inward_eqp_id,
                        "NEPL ID": eq.nepl_id or "",
                        "Material Description": eq.material_description or "",
                        "Make": eq.make or "",
                        "Model": eq.model or "",
                        "Range": eq.range or "",
                        "Serial No": eq.serial_no or "",
                        "Quantity": eq.quantity or 1,
                        "SRF Equipment Unit": srf_eq.unit if srf_eq else "",
                        "No of Calibration Points": srf_eq.no_of_calibration_points if srf_eq else "",
                        "Mode of Calibration": srf_eq.mode_of_calibration if srf_eq else "",
                    }))
            else:
                rows.append(self._sanitize_row(base_row))
        return rows

    def export_pending_srf_section(
        self, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None,
        search_term: Optional[str] = None
    ) -> BytesIO:
        """Export Pending SRF Creation section data."""
        try:
            # Get pending items
            result_map = {}
            
            # Draft SRFs
            query = select(Srf).options(
                selectinload(Srf.inward).selectinload(Inward.equipments)
            ).where(Srf.status == 'draft')
            
            draft_srfs = self.db.scalars(query).all()
            
            # Filter by date and search
            if start_date or end_date or search_term:
                filtered_drafts = []
                for srf in draft_srfs:
                    if srf.inward:
                        if start_date and srf.inward.material_inward_date < start_date:
                            continue
                        if end_date and srf.inward.material_inward_date > end_date:
                            continue
                        if search_term and search_term.lower() not in (str(srf.inward.srf_no) + " " + (srf.inward.customer_details or "")).lower():
                            continue
                        filtered_drafts.append(srf)
                draft_srfs = filtered_drafts
            
            for srf in draft_srfs:
                if srf.inward:
                    result_map[srf.inward.inward_id] = {
                        "inward_id": srf.inward.inward_id,
                        "srf_no": srf.inward.srf_no,
                        "date": srf.inward.material_inward_date,
                        "customer_details": srf.inward.customer_details,
                        "status": 'draft',
                        "srf_id": srf.srf_id,
                        "equipment_count": len(srf.inward.equipments),
                        "equipments": [
                            {
                                "inward_eqp_id": eq.inward_eqp_id,
                                "material_description": eq.material_description,
                                "model": eq.model,
                                "serial_no": eq.serial_no
                            }
                            for eq in srf.inward.equipments
                        ]
                    }
            
            # Fresh Inwards
            existing_srf_subquery = select(Srf.inward_id)
            query = select(Inward).options(selectinload(Inward.equipments)).where(
                Inward.status == 'updated',
                Inward.inward_id.not_in(existing_srf_subquery)
            )
            
            if start_date:
                query = query.where(func.date(Inward.material_inward_date) >= start_date)
            if end_date:
                query = query.where(func.date(Inward.material_inward_date) <= end_date)
            
            fresh_inwards = self.db.scalars(query.order_by(Inward.updated_at.desc())).all()
            
            # Apply search filter to fresh inwards
            if search_term:
                search_lower = search_term.lower()
                fresh_inwards = [
                    inward for inward in fresh_inwards
                    if search_lower in (str(inward.srf_no) + " " + (inward.customer_details or "")).lower()
                ]
            
            for inward in fresh_inwards:
                if inward.inward_id not in result_map:
                    result_map[inward.inward_id] = {
                        "inward_id": inward.inward_id,
                        "srf_no": inward.srf_no,
                        "date": inward.material_inward_date,
                        "customer_details": inward.customer_details,
                        "status": inward.status,
                        "srf_id": None,
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
            
            items = list(result_map.values())
            rows = self._build_pending_srf_export_rows(items)
            
            df = pd.DataFrame(rows)
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Pending SRF Creation")
            output.seek(0)
            return output
        except Exception as e:
            logger.error(f"Failed to export pending SRF section: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate export.")

    def export_srf_section_by_status(
        self,
        status_filter: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search_term: Optional[str] = None
    ) -> BytesIO:
        """Export SRF section data by status (customer_review, approved, rejected)."""
        try:
            # Map frontend status to database status
            status_map = {
                "customer_review": ["inward_completed", "generated"],
                "approved": ["approved"],
                "rejected": ["rejected"]
            }
            
            db_statuses = status_map.get(status_filter, [])
            if not db_statuses:
                raise HTTPException(status_code=400, detail=f"Invalid status filter: {status_filter}")
            
            query = select(Srf).options(
                selectinload(Srf.inward).options(
                    selectinload(Inward.customer),
                    selectinload(Inward.equipments).selectinload(InwardEquipment.srf_equipment)
                )
            ).where(Srf.status.in_(db_statuses))
            
            srfs = self.db.scalars(query.order_by(Srf.srf_id.desc())).all()
            
            # Apply date and search filters
            if start_date or end_date or search_term:
                filtered_srfs = []
                search_lower = search_term.lower() if search_term else None
                for srf in srfs:
                    if srf.inward:
                        if start_date and srf.inward.material_inward_date < start_date:
                            continue
                        if end_date and srf.inward.material_inward_date > end_date:
                            continue
                        if search_lower and search_lower not in (str(srf.srf_no) + " " + (srf.inward.customer_details or "")).lower():
                            continue
                        filtered_srfs.append(srf)
                srfs = filtered_srfs
            
            rows = self._build_srf_export_rows(srfs)
            
            sheet_name_map = {
                "customer_review": "Customer Review Pending",
                "approved": "Approved",
                "rejected": "Rejected"
            }
            sheet_name = sheet_name_map.get(status_filter, "SRF Export")
            
            df = pd.DataFrame(rows)
            output = BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name=sheet_name[:31])
            output.seek(0)
            return output
        except Exception as e:
            logger.error(f"Failed to export SRF section {status_filter}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to generate export.")