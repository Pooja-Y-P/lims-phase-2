# file: backend/services/inward_services.py

import uuid
import os
import aiofiles
import secrets
import string
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, desc, or_, update
from fastapi import HTTPException, status, UploadFile, BackgroundTasks
from datetime import datetime, timezone, timedelta
import json

# Model and Schema imports
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.schemas.inward_schemas import InwardCreate, InwardUpdate, DraftResponse

# Service imports
from backend.services.delayed_email_services import DelayedEmailService
# <-- FIX: Import SrfService to generate SRF numbers -->
from backend.services.srf_services import SrfService

# Core Service Imports
from backend.core.security import create_invitation_token, hash_password
from backend.core.email import (
    send_new_user_invitation_email,
    send_existing_user_notification_email
)

UPLOAD_DIRECTORY = "uploads/inward_photos"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

class InwardService:
    def __init__(self, db: Session):
        self.db = db

    def _get_receiver_id(self, receiver_name: str) -> int:
        user = self.db.execute(select(User).where(User.username == receiver_name)).scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail=f"Receiver user '{receiver_name}' not found.")
        return user.user_id

    # --- SIMPLIFIED DRAFT MANAGEMENT ---
    
    async def get_user_drafts(self, user_id: int) -> List[DraftResponse]:
        """Get all draft inward records for a user"""
        try:
            drafts = self.db.execute(
                select(Inward).where(
                    and_(
                        Inward.created_by == user_id, 
                        Inward.is_draft == True
                    )
                ).order_by(desc(Inward.draft_updated_at))
            ).scalars().all()
            
            result = []
            for draft in drafts:
                draft_data = draft.draft_data if draft.draft_data else {}
                
                result.append(DraftResponse(
                    inward_id=draft.inward_id,
                    draft_updated_at=(draft.draft_updated_at or draft.created_at).isoformat(),
                    customer_details=draft_data.get('customer_details') or draft.customer_details,
                    draft_data=draft_data
                ))
            
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve drafts: {str(e)}")

    async def get_draft_by_id(self, draft_id: int, user_id: int) -> DraftResponse:
        """Get a specific draft by its ID, ensuring it belongs to the user."""
        try:
            draft = self.db.execute(
                select(Inward).where(
                    and_(
                        Inward.inward_id == draft_id,
                        Inward.created_by == user_id,
                        Inward.is_draft == True
                    )
                )
            ).scalars().first()

            if not draft:
                raise HTTPException(status_code=404, detail="Draft not found or access denied")

            draft_data = draft.draft_data if draft.draft_data else {}
            
            return DraftResponse(
                inward_id=draft.inward_id,
                draft_updated_at=(draft.draft_updated_at or draft.created_at).isoformat(),
                customer_details=draft_data.get('customer_details') or draft.customer_details,
                draft_data=draft_data
            )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve draft: {str(e)}")

    async def update_draft(self, user_id: int, inward_id: Optional[int], draft_data: Dict[str, Any]) -> DraftResponse:
        """
        Saves a draft. If inward_id is provided, it updates an existing draft.
        Otherwise, it creates a new draft record.
        """
        try:
            current_time = datetime.now(timezone.utc)

            if inward_id:
                # UPDATE an existing draft
                draft = self.db.get(Inward, inward_id)
                if not draft or draft.created_by != user_id:
                    raise HTTPException(status_code=404, detail="Draft not found or access denied")
                
                if not draft.is_draft:
                    raise HTTPException(status_code=400, detail="Cannot update a finalized record as a draft")

                # Merge new data with existing JSON data
                current_draft_data = draft.draft_data or {}
                current_draft_data.update(draft_data)
                draft.draft_data = current_draft_data
                
                # Update top-level fields for easier access/display if they exist in the payload
                if 'customer_details' in draft_data:
                    draft.customer_details = draft_data['customer_details']
                # Store srf_no at the top level, allowing None, instead of 0.
                if 'srf_no' in draft_data:
                    draft.srf_no = draft_data.get('srf_no')

                draft.draft_updated_at = current_time

            else:
                # CREATE a new draft
                draft = Inward(
                    srf_no=draft_data.get('srf_no'),  # Store number if provided, else None.
                    date=datetime.now(timezone.utc).date(),
                    customer_details=draft_data.get('customer_details', ''),
                    created_by=user_id,
                    status='draft',
                    is_draft=True,
                    draft_data=draft_data,
                    draft_updated_at=current_time
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
                    
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to save draft: {str(e)}")

    async def delete_draft(self, draft_id: int, user_id: int) -> bool:
        """Delete a draft inward record"""
        try:
            draft = self.db.execute(
                select(Inward).where(
                    and_(
                        Inward.inward_id == draft_id,
                        Inward.created_by == user_id,
                        Inward.is_draft == True
                    )
                )
            ).scalars().first()
            
            if not draft:
                return False
            
            # Delete the draft (cascade should handle equipment)
            self.db.delete(draft)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete draft: {str(e)}")

    async def cleanup_old_drafts(self, user_id: int, days_old: int = 30) -> int:
        """Clean up old draft records for a specific user"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            old_drafts = self.db.execute(
                select(Inward).where(
                    and_(
                        Inward.created_by == user_id, 
                        Inward.is_draft == True, 
                        or_(
                            Inward.draft_updated_at < cutoff_date,
                            and_(Inward.draft_updated_at.is_(None), Inward.created_at < cutoff_date)
                        )
                    )
                )
            ).scalars().all()
            
            count = len(old_drafts)
            if count > 0:
                for draft in old_drafts:
                    # Equipment linked via FK with cascade delete will be removed automatically
                    self.db.delete(draft)
                self.db.commit()
            
            return count
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to cleanup drafts: {str(e)}")

    # --- INWARD CREATION & FINALIZATION ---

    async def submit_inward(
        self, 
        inward_data: InwardCreate, 
        files_by_index: Dict[int, List[UploadFile]], 
        user_id: int,
        draft_inward_id: Optional[int] = None
    ) -> Inward:
        """
        Submits/finalizes an inward form. Creates a new record or updates an existing draft.
        If srf_no is not provided, it will be automatically generated.
        """
        try:
            receiver_id = self._get_receiver_id(inward_data.receiver)

            # --- Generate SRF Number if not provided ---
            srf_number = inward_data.srf_no
            if not srf_number:
                srf_service = SrfService(self.db)
                srf_number = srf_service.generate_next_srf_no()

            db_inward: Inward
            if draft_inward_id:
                # --- FINALIZE AN EXISTING DRAFT ---
                db_inward = self.db.get(Inward, draft_inward_id)
                if not db_inward or db_inward.created_by != user_id or not db_inward.is_draft:
                    raise HTTPException(status_code=404, detail="Draft to finalize not found or access denied.")

                # Update the draft record with final values
                db_inward.srf_no = srf_number
                db_inward.date = inward_data.date
                db_inward.customer_dc_date = inward_data.customer_dc_date
                db_inward.customer_details = inward_data.customer_details
                db_inward.received_by = receiver_id
                db_inward.status = 'created'
                db_inward.is_draft = False  # Finalize the draft
                db_inward.draft_data = None  # Clear draft JSON
                db_inward.draft_updated_at = None  # Clear draft timestamp
                db_inward.updated_by = user_id
                db_inward.updated_at = datetime.now(timezone.utc)

                # Clear old equipment to prevent duplicates
                self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == draft_inward_id).delete(synchronize_session=False)
                self.db.flush()

            else:
                # --- CREATE A BRAND NEW RECORD ---
                db_inward = Inward(
                    srf_no=srf_number,
                    date=inward_data.date,
                    customer_dc_date=inward_data.customer_dc_date,
                    customer_details=inward_data.customer_details,
                    received_by=receiver_id,
                    created_by=user_id,
                    status='created',
                    is_draft=False
                )
                self.db.add(db_inward)
                self.db.flush()

            # Process equipment list (common logic for both paths)
            await self._process_equipment_list(db_inward.inward_id, inward_data.equipment_list, files_by_index)
            
            self.db.commit()
            self.db.refresh(db_inward)
            
            return db_inward
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            print(f"ERROR in submit_inward: {e}")
            raise HTTPException(status_code=500, detail="An internal server error occurred.")

    async def update_inward_with_files(self, inward_id: int, inward_data: InwardUpdate, files_by_index: Dict[int, List[UploadFile]], updater_id: int) -> Inward:
        try:
            db_inward = self.db.get(Inward, inward_id)
            if not db_inward:
                raise HTTPException(status_code=404, detail="Inward record not found.")

            receiver_id = self._get_receiver_id(inward_data.receiver)

            db_inward.srf_no = inward_data.srf_no
            db_inward.date = inward_data.date
            db_inward.customer_dc_date = inward_data.customer_dc_date
            db_inward.customer_details = inward_data.customer_details
            db_inward.received_by = receiver_id
            db_inward.updated_by = updater_id
            db_inward.updated_at = datetime.now(timezone.utc)
            db_inward.is_draft = False

            self.db.query(InwardEquipment).filter(InwardEquipment.inward_id == inward_id).delete(synchronize_session=False)
            self.db.flush()

            await self._process_equipment_list(inward_id, inward_data.equipment_list, files_by_index)
            
            self.db.commit()
            self.db.refresh(db_inward)
            
            return db_inward
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")

    async def _process_equipment_list(self, inward_id: int, equipment_list: List, files_by_index: Dict[int, List[UploadFile]]):
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
                nepl_id=eqp_model.nepl_id,
                material_description=eqp_model.material_desc,
                make=eqp_model.make,
                model=eqp_model.model,
                range=eqp_model.range,
                serial_no=eqp_model.serial_no,
                quantity=eqp_model.qty,
                visual_inspection_notes=eqp_model.inspe_notes,
                calibration_by=eqp_model.calibration_by,
                supplier=eqp_model.supplier,
                out_dc=eqp_model.out_dc,
                in_dc=eqp_model.in_dc,
                nextage_contract_reference=eqp_model.nextage_ref,
                qr_code=eqp_model.qr_code,
                barcode=eqp_model.barcode,
                photos=photo_paths,
                remarks=eqp_model.remarks or 'No remarks'
            )
            equipment_models.append(db_equipment)
        
        self.db.add_all(equipment_models)

    async def get_all_inwards(self) -> List[Inward]:
        """Get all finalized inward records (not drafts)"""
        return self.db.execute(
            select(Inward).where(Inward.is_draft.is_(False))
            .order_by(Inward.created_at.desc())
        ).scalars().all()

    async def get_inward_by_id(self, inward_id: int) -> Inward:
        """Get inward by ID (only finalized records)"""
        db_inward = self.db.get(Inward, inward_id)
        if not db_inward or db_inward.is_draft:
            raise HTTPException(status_code=404, detail="Inward record not found or is still a draft.")
        return db_inward

    def generate_temp_password(self, length: int = 10) -> str:
        characters = string.ascii_letters + string.digits
        return ''.join(secrets.choice(characters) for _ in range(length))

    async def process_customer_notification(
        self,
        inward_id: int,
        creator_id: int,
        background_tasks: BackgroundTasks,
        customer_email: Optional[str] = None,
        send_later: bool = False
    ):
        db_inward = await self.get_inward_by_id(inward_id)
        if not db_inward.customer_details:
            raise HTTPException(status_code=400, detail="Inward is missing customer details.")

        creator_user = self.db.get(User, creator_id)
        created_by_name = creator_user.username if creator_user else f"user_{creator_id}"

        if send_later:
            delayed_service = DelayedEmailService(self.db)
            await delayed_service.schedule_delayed_email(
                inward_id=inward_id,
                recipient_email=customer_email,
                creator_id=creator_id,
                delay_hours=24
            )
            return {"message": f"Report for SRF {db_inward.srf_no} scheduled. Manage it from the Engineer Portal."}

        if not customer_email:
            raise HTTPException(status_code=422, detail="Customer email is required for immediate sending.")

        existing_user = self.db.scalars(select(User).where(User.email == customer_email)).first()

        if existing_user:
            if existing_user.role.lower() != 'customer':
                raise HTTPException(status_code=400, detail="An internal staff account already exists with this email.")
            
            if not db_inward.customer_id and existing_user.customer_id:
                db_inward.customer_id = existing_user.customer_id
                self.db.commit()

            success = await send_existing_user_notification_email(
                background_tasks=background_tasks,
                recipient_email=existing_user.email,
                inward_id=db_inward.inward_id,
                srf_no=db_inward.srf_no,
                db=self.db,
                created_by=created_by_name
            )
            
            if success:
                return {"message": f"Notification sent to existing customer {customer_email}."}
            else:
                raise HTTPException(status_code=500, detail="Failed to queue notification email.")
        else:
            customer = self.db.scalars(select(Customer).where(Customer.customer_details == db_inward.customer_details)).first()
            if not customer:
                customer = Customer(customer_details=db_inward.customer_details, email=customer_email)
                self.db.add(customer)
                self.db.flush()

            db_inward.customer_id = customer.customer_id
            
            temp_password = self.generate_temp_password()
            
            new_user = User(
                email=customer_email,
                username=customer_email,
                password_hash=hash_password(temp_password),
                role='customer',
                is_active=False,
                customer_id=customer.customer_id
            )
            self.db.add(new_user)
            
            invitation_token = create_invitation_token(subject=customer_email)
            new_invitation = Invitation(
                email=customer_email,
                token=invitation_token,
                customer_id=customer.customer_id,
                created_by=creator_id,
            )
            self.db.add(new_invitation)
            self.db.commit()
            
            success = await send_new_user_invitation_email(
                background_tasks=background_tasks,
                recipient_email=customer_email,
                token=invitation_token,
                srf_no=db_inward.srf_no,
                temp_password=temp_password,
                db=self.db,
                inward_id=db_inward.inward_id,
                created_by=created_by_name
            )
            
            if success:
                return {"message": f"Account created and invitation with temporary password sent to {customer_email}."}
            else:
                raise HTTPException(status_code=500, detail="Failed to queue invitation email.")

    async def send_scheduled_report_now(self, task_id: int, customer_email: str, background_tasks: BackgroundTasks) -> bool:
        delayed_service = DelayedEmailService(self.db)
        task = await delayed_service.get_task_by_id(task_id)

        if not task:
            raise HTTPException(status_code=404, detail="Scheduled task not found.")
        if task.is_sent or task.is_cancelled:
            raise HTTPException(status_code=400, detail="This task has already been processed.")

        task.recipient_email = customer_email
        self.db.commit()

        await self.process_customer_notification(
            inward_id=task.inward_id,
            creator_id=task.created_by,
            customer_email=customer_email,
            background_tasks=background_tasks,
            send_later=False
        )

        await delayed_service.mark_task_as_sent(task_id)
        return True