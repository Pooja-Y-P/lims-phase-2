import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Iterable
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, case, and_
from fastapi import HTTPException, status
import logging

# Models
from backend.models.users import User
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.invitations import Invitation
from backend.models.srfs import Srf
from backend.models.customers import Customer

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
                    Inward.status == 'created'
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
            else:
                categorized_srfs["pending"].append(srf)
        
        return categorized_srfs

    # --- SRF STATUS UPDATE METHOD ---
    
    async def update_srf_status(self, srf_id: int, customer_id: int, new_status: str, remarks: Optional[str] = None) -> Srf:
        """
        Allows a customer to approve or reject an SRF.
        Validates ownership and current status before updating.
        """
        # Find the SRF and join with Inward to verify the customer_id
        srf_to_update = self.db.query(Srf).join(Inward).filter(
            Srf.srf_id == srf_id,
            Inward.customer_id == customer_id
        ).first()

        if not srf_to_update:
            raise HTTPException(status_code=404, detail="SRF not found or you do not have permission to access it.")
        
        # Define which statuses can be changed by the customer
        valid_initial_statuses = ['pending', 'inward_completed', 'reviewed', 'updated']
        if srf_to_update.status.lower() not in valid_initial_statuses:
            raise HTTPException(status_code=400, detail=f"This SRF cannot be updated from its current status: '{srf_to_update.status}'")

        # Update the status and remarks
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
            # 1. Fetch the Inward record
            stmt = select(Inward).where(Inward.inward_id == inward_id, Inward.is_draft.is_(False))
            if customer_id:
                stmt = stmt.where(Inward.customer_id == customer_id)
            
            inward = self.db.scalars(stmt).first()
            
            # 2. Validation
            if not inward:
                raise HTTPException(status_code=404, detail="Inward record not found or access denied.")
            
            # Allow customers to view 'reviewed' items as well (read-only likely), but strictly block others if needed
            if inward.status not in ['created', 'reviewed']:
                # You might want to allow viewing historical data, so consider removing this check if they just want to view read-only data
                pass 
                # raise HTTPException(status_code=400, detail=f"This inward is not ready for review. Current status: {inward.status}")
            
            # 3. Fetch and Sort Equipments
            # Sort by Deviation (Not OK) first, then by ID
            deviation_case = case((InwardEquipment.visual_inspection_notes != "OK", 1), else_=0).desc()
            
            sorted_equipments = self.db.query(InwardEquipment).filter(
                InwardEquipment.inward_id == inward_id
            ).order_by(deviation_case, InwardEquipment.inward_eqp_id).all()
            
            # 4. Build Response List
            equipment_list = []
            for eq in sorted_equipments:
                equipment_list.append({
                    "inward_eqp_id": eq.inward_eqp_id, 
                    "nepl_id": eq.nepl_id,
                    "material_description": eq.material_description, 
                    "make": eq.make,
                    "model": eq.model, 
                    "serial_no": eq.serial_no,
                    "visual_inspection_notes": eq.visual_inspection_notes,
                    "customer_remarks": eq.customer_remarks,
                    "photos": self._format_photo_paths(eq.photos)
                })
            
            # 5. Return Pydantic Schema
            return InwardForCustomer(
                inward_id=inward.inward_id, 
                srf_no=inward.srf_no, 
                material_inward_date=inward.material_inward_date, 
                status=inward.status, 
                equipments=equipment_list
            )

        except HTTPException:
            # Re-raise HTTP exceptions (like 404) directly
            raise
        except Exception as e:
            # Log the actual system error for debugging
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
            
            if inward.status != 'created':
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This FIR has already been reviewed or is not ready for remarks. Current status: {inward.status}")
            
            equipment_ids_to_update = {item.inward_eqp_id: item.customer_remarks for item in remarks_data.remarks}
            
            if equipment_ids_to_update:
                stmt = select(InwardEquipment).where(InwardEquipment.inward_id == inward_id, InwardEquipment.inward_eqp_id.in_(equipment_ids_to_update.keys()))
                equipments = self.db.scalars(stmt).all()
                
                if len(equipments) != len(equipment_ids_to_update):
                    raise HTTPException(status_code=400, detail="One or more equipment IDs are invalid for this inward.")
                
                for eqp in equipments:
                    eqp.customer_remarks = equipment_ids_to_update.get(eqp.inward_eqp_id)
                    eqp.updated_at = datetime.utcnow()
            
            inward.status = 'reviewed'
            inward.updated_at = datetime.utcnow()
            self.db.commit()
            return {"message": "Remarks submitted successfully", "status": "reviewed"}
        
        except HTTPException:
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error submitting customer remarks: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to submit remarks")

    # --- DIRECT ACCESS METHODS ---
    def get_fir_for_direct_access(self, inward_id: int, access_token: str = None) -> InwardForCustomer:
        # Logic to validate token can be added here if needed
        return self.get_fir_for_customer_review(inward_id, customer_id=None)
    
    def submit_remarks_direct_access(self, inward_id: int, remarks_data: RemarksSubmissionRequest, access_token: str = None):
        # Logic to validate token can be added here if needed
        return self.submit_customer_remarks(inward_id, remarks_data, customer_id=None)

    def get_all_customers_for_dropdown(self) -> List[Dict[str, Any]]:
        """
        Retrieves all active customers with their ID, details, email, and addresses.
        """
        # --- UPDATED QUERY TO FETCH ADDRESSES ---
        stmt = (
            select(
                Customer.customer_id,
                Customer.customer_details,
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
                "email": c.email,
                "ship_to_address": c.ship_to_address,
                "bill_to_address": c.bill_to_address
            } 
            for c in customers
        ]