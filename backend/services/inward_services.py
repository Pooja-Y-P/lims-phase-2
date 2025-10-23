import uuid
import os
import aiofiles
import secrets
import string
import json
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status, UploadFile, BackgroundTasks

# Model and Schema imports
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.schemas.inward_schemas import InwardCreate
from backend.services.delayed_email_services import DelayedEmailService

# Core Service Imports
from backend.core.security import create_invitation_token, hash_password
# --- THIS IS THE FIX: Updated import names ---
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

    async def create_inward_with_files(self, inward_data: InwardCreate, files_by_index: Dict[int, List[UploadFile]], creator_id: int) -> Inward:
        try:
            receiver_id = self._get_receiver_id(inward_data.receiver)
            
            db_inward = Inward(
                srf_no=inward_data.srf_no,
                date=inward_data.date,
                customer_dc_date=inward_data.customer_dc_date,
                customer_details=inward_data.customer_details,
                received_by=receiver_id,
                created_by=creator_id,
                status='created'
            )
            self.db.add(db_inward)
            self.db.flush()

            equipment_models = []
            for index, eqp_model in enumerate(inward_data.equipment_list):
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
                    inward_id=db_inward.inward_id,
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
            self.db.commit()
            self.db.refresh(db_inward)
            
            return db_inward
        except HTTPException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status_code=500, detail=f"An internal server error occurred: {e}")

    def get_all_inwards(self) -> List[Inward]:
        return self.db.execute(select(Inward).order_by(Inward.created_at.desc())).scalars().all()

    def get_inward_by_id(self, inward_id: int) -> Inward:
        db_inward = self.db.get(Inward, inward_id)
        if not db_inward:
            raise HTTPException(status_code=404, detail="Inward record not found.")
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
        db_inward = self.get_inward_by_id(inward_id)
        if not db_inward.customer_details:
            raise HTTPException(status_code=400, detail="Inward is missing customer details.")

        if send_later:
            delayed_service = DelayedEmailService(self.db)
            delayed_service.schedule_delayed_email(
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
            # --- SCENARIO 1: USER EXISTS ---
            if existing_user.role.lower() != 'customer':
                raise HTTPException(status_code=400, detail="An internal staff account already exists with this email.")
            
            if not db_inward.customer_id and existing_user.customer_id:
                db_inward.customer_id = existing_user.customer_id
                self.db.commit()

            # --- FIX: Use the new function for existing users ---
            await send_existing_user_notification_email(
                background_tasks=background_tasks,
                recipient_email=existing_user.email,
                inward_id=db_inward.inward_id,
                srf_no=db_inward.srf_no,
            )
            return {"message": f"Notification sent to existing customer {customer_email}."}
        else:
            # --- SCENARIO 2: NEW USER (Full Implementation) ---
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
            
            # --- FIX: Use the new function for new users ---
            await send_new_user_invitation_email(
                background_tasks=background_tasks,
                recipient_email=customer_email,
                token=invitation_token,
                srf_no=db_inward.srf_no,
                temp_password=temp_password
            )
            return {"message": f"Account created and invitation with temporary password sent to {customer_email}."}

    async def send_scheduled_report_now(self, task_id: int, customer_email: str, background_tasks: BackgroundTasks) -> bool:
        delayed_service = DelayedEmailService(self.db)
        task = delayed_service.get_task_by_id(task_id)

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
        
        delayed_service.mark_task_as_sent(task_id)
        return True