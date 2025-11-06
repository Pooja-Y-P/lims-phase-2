import uuid
import os
import aiofiles
import secrets
import string
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

from fastapi import HTTPException, status, UploadFile, BackgroundTasks
from sqlalchemy import select, and_, desc, case
from sqlalchemy.orm import Session, joinedload, selectinload

# Model and Schema imports
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.schemas.inward_schemas import (
    InwardCreate, 
    InwardUpdate, 
    DraftResponse,
    ReviewedFirResponse, 
    CustomerInfo
)

# Service imports
from backend.services.delayed_email_services import DelayedEmailService
from backend.services.srf_services import SrfService

# Core Service Imports
from backend.core.security import create_invitation_token, hash_password
from backend.core.email import (
    send_new_user_invitation_email,
    send_existing_user_notification_email
)

# Setup logging
logger = logging.getLogger(__name__)

UPLOAD_DIRECTORY = "uploads/inward_photos"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

class InwardService:
    def __init__(self, db: Session):
        self.db = db

    def _get_receiver_id(self, receiver_name: str) -> int:
        """Helper to find a user ID by username."""
        user = self.db.execute(select(User).where(User.username == receiver_name)).scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail=f"Receiver user '{receiver_name}' not found.")
        return user.user_id

    def generate_temp_password(self, length: int = 12) -> str:
        """Generate a temporary password for new users."""
        characters = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(characters) for _ in range(length))

    # --- DRAFT MANAGEMENT ---
    
    async def get_user_drafts(self, user_id: int) -> List[DraftResponse]:
        """Get all drafts created by a specific user."""
        try:
            drafts = self.db.execute(
                select(Inward).where(and_(Inward.created_by == user_id, Inward.is_draft == True))
                .order_by(desc(Inward.draft_updated_at))
            ).scalars().all()
            return [
                DraftResponse(
                    inward_id=draft.inward_id,
                    draft_updated_at=(draft.draft_updated_at or draft.created_at).isoformat(),
                    customer_details=(draft.draft_data or {}).get('customer_details') or draft.customer_details,
                    draft_data=draft.draft_data or {}
                ) for draft in drafts
            ]
        except Exception as e:
            logger.error(f"Failed to retrieve drafts for user {user_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve drafts.")

    # === THIS IS THE FIRST FIX ===
    async def get_draft_by_id(self, draft_id: int, user_id: int) -> DraftResponse:
        """Get a specific draft by its ID, ensuring it belongs to the user."""
        try:
            draft = self.db.execute(
                select(Inward).where(and_(
                    Inward.inward_id == draft_id,
                    Inward.created_by == user_id,
                    Inward.is_draft == True
                ))
            ).scalars().first()
            
            if not draft:
                raise HTTPException(status_code=404, detail="Draft not found or access denied")
            
            return DraftResponse(
                inward_id=draft.inward_id,
                draft_updated_at=(draft.draft_updated_at or draft.created_at).isoformat(),
                customer_details=(draft.draft_data or {}).get('customer_details') or draft.customer_details,
                draft_data=draft.draft_data or {}
            )
        except Exception as e:
            logger.error(f"Failed to retrieve draft {draft_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve draft.")

    async def update_draft(self, user_id: int, inward_id: Optional[int], draft_data: Dict[str, Any]) -> DraftResponse:
        """Create a new draft or update an existing one."""
        try:
            current_time = datetime.now(timezone.utc)
            if inward_id:
                draft = self.db.get(Inward, inward_id)
                if not draft or draft.created_by != user_id:
                    raise HTTPException(status_code=404, detail="Draft not found or access denied")
                if not draft.is_draft:
                    raise HTTPException(status_code=400, detail="Cannot update a finalized record as a draft")
                current_draft_data = draft.draft_data or {}
                current_draft_data.update(draft_data)
                draft.draft_data = current_draft_data
                draft.customer_details = draft_data.get('customer_details', draft.customer_details)
                draft.srf_no = draft_data.get('srf_no', draft.srf_no)
                draft.draft_updated_at = current_time
            else:
                draft = Inward(
                    srf_no=draft_data.get('srf_no'),
                    date=datetime.now(timezone.utc).date(),
                    customer_details=draft_data.get('customer_details', ''),
                    created_by=user_id, status='draft', is_draft=True,
                    draft_data=draft_data, draft_updated_at=current_time
                )
                self.db.add(draft)
            self.db.commit()
            self.db.refresh(draft)
            return DraftResponse(
                inward_id=draft.inward_id,
                draft_updated_at=(draft.draft_updated_at or draft.created_at).isoformat(),
                customer_details=draft.customer_details,
                draft_data=draft.draft_data
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to save draft: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save draft.")

    # === THIS IS THE SECOND FIX (though it was already correct in your file) ===
    async def delete_draft(self, draft_id: int, user_id: int) -> bool:
        """Delete a draft record."""
        try:
            draft = self.db.execute(
                select(Inward).where(and_(
                    Inward.inward_id == draft_id, 
                    Inward.created_by == user_id, 
                    Inward.is_draft == True
                ))
            ).scalars().first()
            if not draft: return False
            self.db.delete(draft)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete draft {draft_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to delete draft.")

    # --- INWARD CREATION & FINALIZATION ---

    async def submit_inward(
        self,
        inward_data: InwardCreate,
        files_by_index: Dict[int, List[UploadFile]],
        user_id: int,
        draft_inward_id: Optional[int] = None
    ) -> Inward:
        """Submit a new inward or finalize an existing draft."""
        try:
            receiver_id = self._get_receiver_id(inward_data.receiver)
            srf_service = SrfService(self.db)
            srf_number = inward_data.srf_no if inward_data.srf_no else srf_service.generate_next_srf_no()

            db_inward: Inward
            if draft_inward_id:
                db_inward = self.db.get(Inward, draft_inward_id)
                if not db_inward or db_inward.created_by != user_id or not db_inward.is_draft:
                    raise HTTPException(status_code=404, detail="Draft to finalize not found or access denied.")
                
                db_inward.srf_no, db_inward.date, db_inward.customer_dc_date = srf_number, inward_data.date, inward_data.customer_dc_date
                db_inward.customer_details, db_inward.received_by = inward_data.customer_details, receiver_id
                db_inward.status, db_inward.is_draft = 'created', False
                db_inward.draft_data, db_inward.draft_updated_at = None, None
                db_inward.updated_by, db_inward.updated_at = user_id, datetime.now(timezone.utc)
                self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == draft_inward_id).delete(synchronize_session=False)
                self.db.flush()
            else:
                db_inward = Inward(
                    srf_no=srf_number, date=inward_data.date, customer_dc_date=inward_data.customer_dc_date,
                    customer_details=inward_data.customer_details, received_by=receiver_id, created_by=user_id,
                    status='created', is_draft=False
                )
                self.db.add(db_inward)
                self.db.flush()

            await self._process_equipment_list(db_inward.inward_id, inward_data.equipment_list, files_by_index)

            has_deviations = any(eq.inspe_notes and eq.inspe_notes != 'OK' for eq in inward_data.equipment_list)
            if has_deviations:
                db_inward.status = 'first_inspection_completed'

            self.db.commit()
            self.db.refresh(db_inward)
            return db_inward
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error in submit_inward: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="An internal server error occurred while submitting the inward.")

    async def update_inward_with_files(self, inward_id: int, inward_data: InwardUpdate, files_by_index: Dict[int, List[UploadFile]], updater_id: int) -> Inward:
        """Update an existing inward record, including its equipment and files."""
        try:
            db_inward = self.db.get(Inward, inward_id)
            if not db_inward:
                raise HTTPException(status_code=404, detail="Inward record not found.")

            receiver_id = self._get_receiver_id(inward_data.receiver)
            db_inward.srf_no, db_inward.date, db_inward.customer_dc_date = inward_data.srf_no, inward_data.date, inward_data.customer_dc_date
            db_inward.customer_details, db_inward.received_by = inward_data.customer_details, receiver_id
            db_inward.updated_by, db_inward.updated_at = updater_id, datetime.now(timezone.utc)
            db_inward.is_draft = False

            if db_inward.status == 'customer_reviewed':
                db_inward.status = 'updated'
            elif db_inward.status == 'created':
                has_deviations = any(eq.inspe_notes and eq.inspe_notes != 'OK' for eq in inward_data.equipment_list)
                if has_deviations:
                    db_inward.status = 'first_inspection_completed'

            self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == inward_id).delete(synchronize_session=False)
            self.db.flush()
            await self._process_equipment_list(inward_id, inward_data.equipment_list, files_by_index)
            
            self.db.commit()
            self.db.refresh(db_inward)
            return db_inward
        except Exception as e:
            self.db.rollback()
            logger.error(f"Error updating inward {inward_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="An internal server error occurred while updating.")

    async def _process_equipment_list(self, inward_id: int, equipment_list: List, files_by_index: Dict[int, List[UploadFile]]):
        """Helper to process and save a list of equipment with their photos."""
        equipment_models = []
        for index, eqp_model in enumerate(equipment_list):
            photo_paths = []
            if index in files_by_index:
                for file in files_by_index[index]:
                    if file and file.filename:
                        file_extension = os.path.splitext(file.filename)[1]
                        unique_filename = f"{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
                        async with aiofiles.open(file_path, 'wb') as out_file:
                            content = await file.read()
                            await out_file.write(content)
                        photo_paths.append(file_path)

            db_equipment = InwardEquipment(
                inward_id=inward_id,
                nepl_id=eqp_model.nepl_id, material_description=eqp_model.material_desc, make=eqp_model.make,
                model=eqp_model.model, range=eqp_model.range, serial_no=eqp_model.serial_no,
                quantity=eqp_model.qty, visual_inspection_notes=eqp_model.inspe_notes or "OK",
                calibration_by=eqp_model.calibration_by, supplier=eqp_model.supplier, out_dc=eqp_model.out_dc,
                in_dc=eqp_model.in_dc, nextage_contract_reference=eqp_model.nextage_ref,
                qr_code=eqp_model.qr_code, barcode=eqp_model.barcode, photos=photo_paths,
                remarks_and_decision=eqp_model.remarks_and_decision 
            )
            equipment_models.append(db_equipment)
        if equipment_models:
            self.db.add_all(equipment_models)

    # --- INWARD RETRIEVAL ---
    
    async def get_all_inwards(self) -> List[Inward]:
        """Get all non-draft inward records."""
        return self.db.execute(
            select(Inward).where(Inward.is_draft.is_(False)).order_by(Inward.created_at.desc())
        ).scalars().all()

    async def get_inward_by_id(self, inward_id: int) -> Inward:
        """Get a single inward by its ID, ensuring it's not a draft."""
        db_inward = self.db.get(Inward, inward_id)
        if not db_inward or db_inward.is_draft:
            raise HTTPException(status_code=404, detail="Inward record not found or is still a draft.")
        return db_inward
    
    async def get_inward_with_sorted_equipment(self, inward_id: int):
        """Get inward with equipment sorted by deviation status for presentation."""
        try:
            stmt = select(Inward).options(selectinload(Inward.customer)).where(Inward.inward_id == inward_id)
            db_inward = self.db.scalars(stmt).first()
            if not db_inward:
                raise HTTPException(status_code=404, detail="Inward not found")

            deviation_case = case((InwardEquipment.visual_inspection_notes != "OK", 1), else_=0).desc()
            sorted_equipments = self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == inward_id).order_by(deviation_case, InwardEquipment.inward_eqp_id).all()
            
            db_inward.equipments = sorted_equipments
            return db_inward
        except Exception as e:
            logger.error(f"Error getting sorted inward {inward_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve inward with sorted equipment.")

    # --- FIR WORKFLOW & NOTIFICATIONS ---

    async def get_inwards_by_status(self, status: str) -> List[Inward]:
        """
        Fetches a list of inward records by status. This method now returns raw
        SQLAlchemy model objects, and the router handles the schema conversion.
        """
        try:
            stmt = (
                select(Inward)
                .options(selectinload(Inward.customer)) 
                .where(Inward.status == status, Inward.is_draft == False)
                .order_by(desc(Inward.updated_at))
            )
            return self.db.scalars(stmt).all()
        
        except Exception as e:
            logger.error(f"Error getting inwards by status '{status}': {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to retrieve inward data.")

    async def process_customer_notification(
        self, inward_id: int, creator_id: int, background_tasks: BackgroundTasks,
        customer_email: Optional[str] = None, send_later: bool = False
    ):
        """Processes the notification to the customer for FIR review."""
        db_inward = await self.get_inward_by_id(inward_id)
        if not db_inward.customer_details:
            raise HTTPException(status_code=400, detail="Inward is missing customer details.")

        creator_user = self.db.get(User, creator_id)
        created_by_name = creator_user.username if creator_user else f"user_{creator_id}"

        if send_later:
            delayed_service = DelayedEmailService(self.db)
            await delayed_service.schedule_delayed_email(
                inward_id=inward_id, recipient_email=customer_email, creator_id=creator_id, delay_hours=24
            )
            return {"message": f"FIR for SRF {db_inward.srf_no} is scheduled. Manage from the Engineer Portal."}

        if not customer_email:
            raise HTTPException(status_code=422, detail="Customer email is required for immediate sending.")

        existing_user = self.db.scalars(select(User).where(User.email == customer_email)).first()
        if existing_user:
            return await self._notify_existing_customer(db_inward, existing_user, background_tasks, created_by_name)
        else:
            return await self._invite_new_customer(db_inward, customer_email, creator_id, background_tasks, created_by_name)

    async def _notify_existing_customer(self, db_inward, existing_user, background_tasks, created_by_name):
        """Handle notification for an existing customer user."""
        if existing_user.role.lower() != 'customer':
            raise HTTPException(status_code=400, detail="An internal staff account already exists with this email.")
        if not db_inward.customer_id and existing_user.customer_id:
            db_inward.customer_id = existing_user.customer_id
            self.db.commit()
        success = await send_existing_user_notification_email(
            background_tasks=background_tasks, recipient_email=existing_user.email, inward_id=db_inward.inward_id,
            srf_no=db_inward.srf_no, db=self.db, created_by=created_by_name
        )
        if success: return {"message": f"Notification sent to existing customer {existing_user.email}."}
        else: raise HTTPException(status_code=500, detail="Failed to queue notification email.")

    async def _invite_new_customer(self, db_inward, customer_email, creator_id, background_tasks, created_by_name):
        """Handle creating and inviting a new customer user."""
        customer = self.db.scalars(select(Customer).where(Customer.customer_details == db_inward.customer_details)).first()
        if not customer:
            customer = Customer(customer_details=db_inward.customer_details, email=customer_email)
            self.db.add(customer); self.db.flush()
        db_inward.customer_id = customer.customer_id
        temp_password = self.generate_temp_password()
        new_user = User(
            email=customer_email, username=customer_email, password_hash=hash_password(temp_password),
            role='customer', is_active=False, customer_id=customer.customer_id
        )
        self.db.add(new_user)
        invitation_token = create_invitation_token(subject=customer_email)
        new_invitation = Invitation(email=customer_email, token=invitation_token, customer_id=customer.customer_id, created_by=creator_id)
        self.db.add(new_invitation); self.db.commit()
        success = await send_new_user_invitation_email(
            background_tasks=background_tasks, recipient_email=customer_email, token=invitation_token,
            srf_no=db_inward.srf_no, temp_password=temp_password, db=self.db, inward_id=db_inward.inward_id,
            created_by=created_by_name
        )
        if success: return {"message": f"Account created and invitation sent to new customer {customer_email}."}
        else: raise HTTPException(status_code=500, detail="Failed to queue invitation email.")

    async def send_scheduled_report_now(self, task_id: int, customer_email: str, background_tasks: BackgroundTasks) -> dict:
        """Trigger a scheduled FIR email to be sent immediately."""
        try:
            delayed_service = DelayedEmailService(self.db)
            task = await delayed_service.get_task_by_id(task_id)
            if not task or task.is_sent or task.is_cancelled:
                raise HTTPException(status_code=404, detail="Scheduled task not found or already processed.")
            response = await self.process_customer_notification(
                inward_id=task.inward_id, creator_id=task.created_by, customer_email=customer_email,
                send_later=False, background_tasks=background_tasks
            )
            if response: await delayed_service.mark_task_as_sent(task_id)
            return response
        except Exception as e:
            logger.error(f"Error sending scheduled report for task {task_id}: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to send scheduled report immediately.")