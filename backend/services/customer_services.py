import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Iterable
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, case, and_, or_
from fastapi import HTTPException, status
import logging

# Models
from backend.models.users import User
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.invitations import Invitation
from backend.models.srfs import Srf
from backend.models.customers import Customer
from backend.models.htw_job import HTWJob # <--- Added for tracking calibration status

# Schemas
from backend.schemas.customer_schemas import RemarksSubmissionRequest, InwardForCustomer
from backend.core import security
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
logger = logging.getLogger(__name__)

class CustomerPortalService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _format_photo_paths(photos: Optional[Any]) -> List[str]:
        if not photos:
            return []

        if isinstance(photos, str):
            try:
                # Attempt to load stringified JSON first
                loaded = json.loads(photos)
                if isinstance(loaded, list):
                    photos_iterable: Iterable[Any] = loaded
                else:
                    photos_iterable = [loaded]
            except Exception:
                photos_iterable = [photos]
        else:
            photos_iterable = photos

        formatted: List[str] = []
        for photo in photos_iterable:
            if not photo:
                continue
            path = str(photo).replace("\\", "/")
            if path.startswith("http://") or path.startswith("https://"):
                formatted.append(path)
                continue
            path = path.lstrip("/")
            formatted.append(f"/{path}" if path else "")
        return formatted

    # --- LISTING METHODS ---
    
    def get_firs_for_customer_list(self, customer_id: int) -> List[Inward]:
        """Retrieves a list of all inwards for a customer that need FIR review."""
        stmt = (
            select(Inward)
            .where(
                and_(
                    Inward.customer_id == customer_id,
                    or_(
                        Inward.status == 'created',
                        Inward.status == 'reviewed',
                        Inward.status == 'updated'
                    )
                )
            )
            .order_by(Inward.material_inward_date.desc())
        )
        inwards = self.db.scalars(stmt).all()
        return inwards

    def get_srfs_for_customer(self, customer_id: int) -> Dict[str, List[Srf]]:
        """Retrieves all SRFs for a customer, categorized by status."""
        inward_stmt = select(Inward.inward_id).where(Inward.customer_id == customer_id)
        inward_ids = self.db.scalars(inward_stmt).all()

        if not inward_ids:
            return {"pending": [], "approved": [], "rejected": []}

        srf_stmt = (
            select(Srf)
            .where(Srf.inward_id.in_(inward_ids))
            .options(selectinload(Srf.inward))
            .order_by(Srf.created_at.desc())
        )
        all_srfs = self.db.scalars(srf_stmt).all()

        categorized_srfs = {"pending": [], "approved": [], "rejected": []}
        for srf in all_srfs:
            status = srf.status.lower()
            
            if status == "approved":
                categorized_srfs["approved"].append(srf)
            elif status == "rejected":
                categorized_srfs["rejected"].append(srf)
            elif status == "inward_completed":
                categorized_srfs["pending"].append(srf)
        
        return categorized_srfs

    # --- SRF STATUS UPDATE METHOD ---
    
    async def update_srf_status(self, srf_id: int, customer_id: int, new_status: str, remarks: Optional[str] = None) -> Srf:
        """
        Allows a customer to approve or reject an SRF.
        Validates ownership and current status before updating.
        """
        srf_to_update = self.db.query(Srf).join(Inward).filter(
            Srf.srf_id == srf_id,
            Inward.customer_id == customer_id
        ).first()

        if not srf_to_update:
            raise HTTPException(status_code=404, detail="SRF not found or you do not have permission to access it.")
        
        valid_initial_statuses = ['inward_completed', 'pending', 'reviewed', 'updated']
        if srf_to_update.status.lower() not in valid_initial_statuses:
            raise HTTPException(status_code=400, detail=f"This SRF cannot be updated from its current status: '{srf_to_update.status}'")

        srf_to_update.status = new_status
        if new_status == 'rejected' and remarks:
            srf_to_update.remarks = remarks
        
        srf_to_update.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(srf_to_update)
        return srf_to_update

    # --- ACCOUNT ACTIVATION ---
    def activate_account_and_set_password(self, token: str, new_password: str) -> str:
        stmt = select(Invitation).where(Invitation.token == token)
        invitation = self.db.scalars(stmt).first()
        if not invitation or invitation.used_at or invitation.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")
        
        user_stmt = select(User).where(User.email == invitation.email)
        user_to_activate = self.db.scalars(user_stmt).first()
        if not user_to_activate:
             raise HTTPException(status_code=404, detail="Associated user account not found.")

        user_to_activate.password_hash = pwd_context.hash(new_password)
        user_to_activate.is_active = True
        invitation.used_at = datetime.utcnow()
        self.db.commit()

        return security.create_access_token(
            data={"user_id": user_to_activate.user_id, "sub": user_to_activate.email, "role": user_to_activate.role, "customer_id": user_to_activate.customer_id}
        )

    # --- FIR AND REMARKS WORKFLOW ---
    def get_fir_for_customer_review(self, inward_id: int, customer_id: int = None) -> InwardForCustomer:
        try:
            stmt = select(Inward).where(Inward.inward_id == inward_id, Inward.is_draft.is_(False))
            if customer_id:
                stmt = stmt.where(Inward.customer_id == customer_id)
            
            inward = self.db.scalars(stmt).first()
            
            if not inward:
                raise HTTPException(status_code=404, detail="Inward record not found or access denied.")
            
            # Fetch and Sort Equipments
            sorted_equipments = self.db.query(InwardEquipment).filter(
                InwardEquipment.inward_id == inward_id
            ).order_by(InwardEquipment.inward_eqp_id).all()
            
            equipment_list = []
            for eq in sorted_equipments:
                equipment_list.append({
                    "inward_eqp_id": eq.inward_eqp_id,
                    "nepl_id": eq.nepl_id,
                    "material_description": eq.material_description,
                    "make": eq.make,
                    "model": eq.model,
                    "range": eq.range,
                    "serial_no": eq.serial_no,
                    "visual_inspection_notes": eq.visual_inspection_notes,
                    "customer_remarks": eq.customer_remarks,
                    "engineer_remarks": eq.engineer_remarks,
                    "photos": self._format_photo_paths(eq.photos),
                    "status": eq.status # Include status in response
                })
            
            return InwardForCustomer(
                inward_id=inward.inward_id, 
                srf_no=inward.srf_no, 
                material_inward_date=inward.material_inward_date, 
                status=inward.status,
                customer_dc_no=inward.customer_dc_no,
                equipments=equipment_list
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"CRITICAL ERROR in get_fir_for_customer_review: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve FIR details. Please contact support.")

    def submit_customer_remarks(self, inward_id: int, remarks_data: RemarksSubmissionRequest, customer_id: int = None):
        try:
            stmt = select(Inward).where(Inward.inward_id == inward_id)
            if customer_id:
                stmt = stmt.where(Inward.customer_id == customer_id)
            inward = self.db.scalars(stmt).first()
            
            if not inward:
                raise HTTPException(status_code=404, detail="Inward record not found or access denied")
            
            if inward.status not in ['created', 'reviewed', 'updated']:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This FIR has already been finalized. Current status: {inward.status}")
            
            equipment_ids_to_update = {}
            for item in remarks_data.remarks:
                remark_val = getattr(item, "customer_remarks", getattr(item, "customer_remark", None))
                equipment_ids_to_update[item.inward_eqp_id] = remark_val
            
            if equipment_ids_to_update:
                stmt = select(InwardEquipment).where(InwardEquipment.inward_id == inward_id, InwardEquipment.inward_eqp_id.in_(equipment_ids_to_update.keys()))
                equipments = self.db.scalars(stmt).all()
                
                for eqp in equipments:
                    new_remark = equipment_ids_to_update.get(eqp.inward_eqp_id)
                    if new_remark is not None:
                        eqp.customer_remarks = new_remark
                        eqp.status = 'reviewed'  # --- FIX: Update equipment status here ---
                        eqp.updated_at = datetime.utcnow()
            
            # Update parent Inward status to 'reviewed' if it was 'created'
            if inward.status == 'created':
                inward.status = 'reviewed'
                
            inward.updated_at = datetime.utcnow()
            self.db.commit()
            
            return {"message": "Remarks submitted successfully", "status": inward.status}
        
        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error submitting customer remarks: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to submit remarks")

    # --- TRACKING HELPER ---
    
    def _determine_timeline_and_status(self, equipment: InwardEquipment, inward: Inward, job: Optional[HTWJob]):
        """
        Calculates the specific timeline steps and current status based on user rules.
        """
        steps = [
            {"label": "Received", "key": "received", "icon": "box"},
            {"label": "Inward", "key": "inward", "icon": "file"},
            {"label": "Calibration In Progress", "key": "calibration", "icon": "settings"},
            {"label": "Calibration Completed", "key": "completed", "icon": "check"},
            {"label": "Certificate Dispatched", "key": "dispatched", "icon": "truck"},
        ]

        activity_log = []
        
        # 1. Received
        received_date = inward.material_inward_date.strftime("%Y-%m-%d")
        activity_log.append({
            "date": received_date,
            "title": "Material Received",
            "description": f"Received at gate via DC: {inward.customer_dc_no or 'N/A'}"
        })
        
        # 2. Inward Created
        inward_date = inward.created_at.strftime("%Y-%m-%d %H:%M") if inward.created_at else received_date
        activity_log.append({
            "date": inward_date,
            "title": "Inward Entry Created",
            "description": f"SRF Generated: {inward.srf_no}"
        })

        # Logic State Variables
        current_step_index = 1 # Default is Inward (Step index 0=Received, 1=Inward)
        display_status = "Inward Generated"

        # Check Job Status (if job exists)
        if job:
            job_status = (job.job_status or "").lower()
            
            # Calibration Started
            if job.created_at:
                activity_log.insert(0, {
                    "date": job.created_at.strftime("%Y-%m-%d %H:%M"),
                    "title": "Calibration Started",
                    "description": f"Job #{job.job_id} assigned to technician."
                })
                current_step_index = 2
                display_status = "Calibration In Progress"

            # Calibration Completed
            if job_status in ['completed', 'calibrated', 'closed']:
                current_step_index = 3
                display_status = "Calibration Completed"
                # Fake update time for demo if not tracked explicitly as finished_at
                completed_date = datetime.now().strftime("%Y-%m-%d %H:%M") # Replace with job.updated_at if valid
                activity_log.insert(0, {
                    "date": completed_date, 
                    "title": "Calibration Completed",
                    "description": "Final readings recorded."
                })

        # Check Specific Equipment Status fields (overrides Job status)
        eq_status = (equipment.status or "").lower()
        if eq_status == 'dispatched':
            current_step_index = 4
            display_status = "Certificate Dispatched"
            activity_log.insert(0, {
                 "date": datetime.now().strftime("%Y-%m-%d"),
                 "title": "Dispatched",
                 "description": "Material and Certificate sent to customer."
            })

        # Construct Timeline Objects
        timeline_response = []
        for idx, step in enumerate(steps):
            status = "pending"
            if idx < current_step_index:
                status = "completed"
            elif idx == current_step_index:
                status = "current"
            
            # Assign dates to completed steps based on available data
            step_date = None
            if idx == 0: step_date = received_date
            if idx == 1: step_date = inward_date
            
            timeline_response.append({
                "label": step["label"],
                "status": status,
                "date": step_date,
                "icon": step["icon"]
            })

        return display_status, timeline_response, activity_log

    # --- TRACKING METHODS ---
    
    def track_equipment_status(self, customer_id: int, query_str: str) -> Optional[Dict[str, Any]]:
        """
        Smart Search Logic:
        1. Search by SRF or DC Number -> Returns ALL equipments for that Inward.
        2. Search by NEPL ID -> Returns ONLY that specific equipment.
        
        Includes detailed timeline logic via _determine_timeline_and_status.
        """
        clean_query = query_str.strip()
        
        # --- STRATEGY 1: Search for Inward-level reference (SRF or DC) ---
        inward_conditions = [
            Inward.srf_no.ilike(f"{clean_query}"),
            Inward.customer_dc_no.ilike(f"{clean_query}")
        ]
        
        stmt_inward_check = (
            select(Inward)
            .where(
                and_(
                    Inward.customer_id == customer_id,
                    or_(*inward_conditions)
                )
            )
        )
        inward_result = self.db.scalars(stmt_inward_check).first()

        target_inward_id = None
        filter_nepl_id = None # If set, we only fetch this specific equipment

        if inward_result:
            # Matched via Inward Reference -> We want ALL items in this inward
            target_inward_id = inward_result.inward_id
            found_via = "Reference No (SRF/DC)"
            if inward_result.srf_no.lower() == clean_query.lower(): found_via = "SRF Number"
            if inward_result.customer_dc_no and inward_result.customer_dc_no.lower() == clean_query.lower(): found_via = "DC Number"
        else:
            # --- STRATEGY 2: Search for specific Equipment ID (NEPL ID) ---
            stmt_eq_check = (
                select(InwardEquipment.inward_id, InwardEquipment.nepl_id)
                .join(Inward, InwardEquipment.inward_id == Inward.inward_id)
                .where(
                    and_(
                        Inward.customer_id == customer_id,
                        InwardEquipment.nepl_id.ilike(f"{clean_query}")
                    )
                )
            )
            eq_match = self.db.execute(stmt_eq_check).first()
            
            if eq_match:
                target_inward_id = eq_match.inward_id
                filter_nepl_id = eq_match.nepl_id # Only return this one
                found_via = "NEPL ID"
            else:
                return None # No matches found

        # --- FETCH FULL DATA ---
        # Fetch Equipment + Parent Inward + Customer Info + Job Info (Left Join)
        query = (
            select(InwardEquipment, Inward, Customer, HTWJob)
            .join(Inward, InwardEquipment.inward_id == Inward.inward_id)
            .join(Customer, Inward.customer_id == Customer.customer_id)
            .outerjoin(HTWJob, HTWJob.inward_eqp_id == InwardEquipment.inward_eqp_id)
            .where(InwardEquipment.inward_id == target_inward_id)
        )

        if filter_nepl_id:
            query = query.where(InwardEquipment.nepl_id == filter_nepl_id)
            
        results = self.db.execute(query.order_by(InwardEquipment.inward_eqp_id)).all()
        
        formatted_equipments = []
        
        for row in results:
            eq, inward, cust, job = row
            
            # Calculate Status & Timeline
            display_status, timeline, logs = self._determine_timeline_and_status(eq, inward, job)
            
            formatted_equipments.append({
                "nepl_id": eq.nepl_id,
                "inward_eqp_id": eq.inward_eqp_id,
                "srf_no": inward.srf_no,
                "customer_name": cust.customer_details,
                "dc_number": inward.customer_dc_no,
                "qty": 1, 
                "current_status": eq.status or "received",
                "display_status": display_status,
                "timeline": timeline,
                "activity_log": logs,
                "expected_completion": "TBD" # Could calculate TAT logic here
            })

        return {
            "search_query": clean_query,
            "found_via": found_via,
            "equipments": formatted_equipments
        }

    # --- DIRECT ACCESS METHODS ---
    def get_fir_for_direct_access(self, inward_id: int, access_token: str = None) -> InwardForCustomer:
        return self.get_fir_for_customer_review(inward_id, customer_id=None)
    
    def submit_remarks_direct_access(self, inward_id: int, remarks_data: RemarksSubmissionRequest, access_token: str = None):
        return self.submit_customer_remarks(inward_id, remarks_data, customer_id=None)

    def get_all_customers_for_dropdown(self) -> List[Dict[str, Any]]:
        stmt = (
            select(
                Customer.customer_id,
                Customer.customer_details,
                Customer.contact_person,
                Customer.phone,
                Customer.email,
                Customer.ship_to_address,
                Customer.bill_to_address
            )
            .where(Customer.is_active.is_(True))
            .order_by(Customer.customer_details)
        )
        
        customers = self.db.execute(stmt).all()
        
        return [
            {
                "customer_id": c.customer_id, 
                "customer_details": c.customer_details,
                "contact_person": c.contact_person,
                "phone": c.phone,
                "email": c.email,
                "ship_to_address": c.ship_to_address,
                "bill_to_address": c.bill_to_address
            } 
            for c in customers
        ]