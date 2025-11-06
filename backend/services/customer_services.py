from datetime import datetime
from typing import List, Optional, Dict
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, func, case, and_
from fastapi import HTTPException, status

# Models
from backend.models.users import User
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.invitations import Invitation
from backend.models.srfs import Srf

# Schemas
from backend.schemas.customer_schemas import RemarksSubmissionRequest, InwardForCustomer
from backend.core import security
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CustomerPortalService:
    def __init__(self, db: Session):
        self.db = db

    # --- LISTING METHODS ---
    
    def get_firs_for_customer_list(self, customer_id: int) -> List[Inward]:
        """Retrieves a list of all inwards for a customer that need FIR review."""
        stmt = (
            select(Inward)
            .where(
                and_(
                    Inward.customer_id == customer_id,
                    Inward.status == 'first_inspection_completed'
                )
            )
            .order_by(Inward.date.desc())
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
    
    # THIS IS THE NEW METHOD YOU NEED TO ADD
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
        valid_initial_statuses = ['pending', 'inward_completed', 'customer_reviewed', 'updated']
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
            stmt = select(Inward).where(Inward.inward_id == inward_id, Inward.is_draft.is_(False))
            if customer_id:
                stmt = stmt.where(Inward.customer_id == customer_id)
            inward = self.db.scalars(stmt).first()
            if not inward:
                raise HTTPException(status_code=404, detail="Inward record not found or access denied.")
            if inward.status not in ['first_inspection_completed', 'customer_reviewed']:
                raise HTTPException(status_code=400, detail=f"This inward is not ready for review. Current status: {inward.status}")
            
            deviation_case = case((InwardEquipment.visual_inspection_notes != "OK", 1), else_=0).desc()
            sorted_equipments = self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == inward_id).order_by(deviation_case, InwardEquipment.inward_eqp_id).all()
            
            equipment_list = [
                {
                    "inward_eqp_id": eq.inward_eqp_id, "nepl_id": eq.nepl_id,
                    "material_description": eq.material_description, "make": eq.make,
                    "model": eq.model, "serial_no": eq.serial_no,
                    "visual_inspection_notes": eq.visual_inspection_notes,
                    "remarks_and_decision": eq.remarks_and_decision,
                } for eq in sorted_equipments
            ]
            return InwardForCustomer(inward_id=inward.inward_id, srf_no=inward.srf_no, date=inward.date, status=inward.status, equipments=equipment_list)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to retrieve FIR details")

    def submit_customer_remarks(self, inward_id: int, remarks_data: RemarksSubmissionRequest, customer_id: int = None):
        try:
            stmt = select(Inward).where(Inward.inward_id == inward_id)
            if customer_id:
                stmt = stmt.where(Inward.customer_id == customer_id)
            inward = self.db.scalars(stmt).first()
            if not inward:
                raise HTTPException(status_code=404, detail="Inward record not found or access denied")
            if inward.status != 'first_inspection_completed':
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This FIR has already been reviewed or is not ready for remarks. Current status: {inward.status}")
            
            equipment_ids_to_update = {item.inward_eqp_id: item.remarks_and_decision for item in remarks_data.remarks}
            if equipment_ids_to_update:
                stmt = select(InwardEquipment).where(InwardEquipment.inward_id == inward_id, InwardEquipment.inward_eqp_id.in_(equipment_ids_to_update.keys()))
                equipments = self.db.scalars(stmt).all()
                if len(equipments) != len(equipment_ids_to_update):
                    raise HTTPException(status_code=400, detail="One or more equipment IDs are invalid for this inward.")
                for eqp in equipments:
                    eqp.remarks_and_decision = equipment_ids_to_update.get(eqp.inward_eqp_id)
                    eqp.updated_at = datetime.utcnow()
            
            inward.status = 'customer_reviewed'
            inward.updated_at = datetime.utcnow()
            self.db.commit()
            return {"message": "Remarks submitted successfully", "status": "customer_reviewed"}
        except HTTPException:
            raise
        except Exception:
            self.db.rollback()
            raise HTTPException(status_code=500, detail="Failed to submit remarks")

    # --- DIRECT ACCESS METHODS ---
    def get_fir_for_direct_access(self, inward_id: int, access_token: str = None) -> InwardForCustomer:
        return self.get_fir_for_customer_review(inward_id, customer_id=None)
    
    def submit_remarks_direct_access(self, inward_id: int, remarks_data: RemarksSubmissionRequest, access_token: str = None):
        return self.submit_customer_remarks(inward_id, remarks_data, customer_id=None)