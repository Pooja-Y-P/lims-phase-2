from datetime import datetime
from typing import List
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import select, func
from fastapi import HTTPException, status

from backend.models.users import User
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.invitations import Invitation
from backend.schemas.customer_schemas import RemarksSubmissionRequest
from backend.core import security
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CustomerPortalService:
    def __init__(self, db: Session):
        self.db = db

    def activate_account_and_set_password(self, token: str, new_password: str) -> str:
        """
        Activates a user account using an invitation token and sets their password.
        Returns a JWT for immediate login.
        """
        stmt = select(Invitation).where(Invitation.token == token)
        invitation = self.db.scalars(stmt).first()

        if not invitation or invitation.is_used or invitation.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")
        
        user_to_activate = self.db.get(User, invitation.user_to_activate_id)
        if not user_to_activate:
             raise HTTPException(status_code=404, detail="Associated user account not found.")

        # Set password and activate user
        user_to_activate.password_hash = pwd_context.hash(new_password)
        user_to_activate.is_active = True
        
        # Invalidate the invitation
        invitation.is_used = True
        
        self.db.commit()

        # Create and return a JWT for immediate login
        return security.create_access_token(
            data={
                "user_id": user_to_activate.user_id,
                "sub": user_to_activate.email,
                "role": user_to_activate.role,
            }
        )
        
    def get_customer_inwards(self, customer_id: int) -> List[dict]:
        """Retrieves a summarized list of all inwards for a specific customer."""
        stmt = (
            select(
                Inward.inward_id,
                Inward.srf_no,
                Inward.date,
                Inward.status,
                func.count(InwardEquipment.inward_eqp_id).label("equipment_count")
            )
            .join(Inward.equipments, isouter=True)
            .where(Inward.customer_id == customer_id)
            .group_by(Inward.inward_id)
            .order_by(Inward.date.desc())
        )
        results = self.db.execute(stmt).all()
        return [row._asdict() for row in results]

    def get_customer_inward_details(self, inward_id: int, customer_id: int) -> Inward:
        """
        Retrieves full details of a single inward, including its equipment list.
        Crucially, ensures the inward belongs to the requesting customer.
        """
        stmt = (
            select(Inward)
            .options(selectinload(Inward.equipments))
            .where(Inward.inward_id == inward_id, Inward.customer_id == customer_id)
        )
        inward = self.db.scalars(stmt).first()

        if not inward:
            raise HTTPException(status_code=404, detail="Inward record not found or access denied.")
            
        return inward

    def submit_equipment_remarks(self, inward_id: int, remarks_data: RemarksSubmissionRequest, customer_id: int):
        """
        Updates remarks for multiple equipment items within a specific inward.
        Performs an authorization check to ensure the inward belongs to the customer.
        """
        # Step 1: Authorize and fetch the inward
        inward = self.get_customer_inward_details(inward_id, customer_id)

        # Step 2: Prepare for bulk update
        equipment_ids_to_update = {item.inward_eqp_id: item.remarks for item in remarks_data.remarks}
        
        # Step 3: Fetch the equipment objects to be updated
        stmt = select(InwardEquipment).where(
            InwardEquipment.inward_id == inward_id,
            InwardEquipment.inward_eqp_id.in_(equipment_ids_to_update.keys())
        )
        equipments = self.db.scalars(stmt).all()
        
        if len(equipments) != len(equipment_ids_to_update):
            raise HTTPException(status_code=400, detail="One or more equipment IDs are invalid for this inward.")

        # Step 4: Update remarks and inward status
        for eqp in equipments:
            eqp.remarks = equipment_ids_to_update.get(eqp.inward_eqp_id)
        
        inward.status = 'remarks_added'
        self.db.commit()