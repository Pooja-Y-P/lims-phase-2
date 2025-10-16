import uuid
import os
import aiofiles
from typing import List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status, UploadFile, BackgroundTasks

# --- Model and Schema imports ---
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.users import User
from backend.models.customers import Customer
from backend.models.invitations import Invitation
from backend.schemas.inward_schemas import InwardCreate

# --- Core Service Imports ---
from backend.core.security import create_invitation_token
from backend.core.email import (
    send_customer_invitation_email,
    send_inward_remarks_notification_email
)

UPLOAD_DIRECTORY = "uploads/inward_photos"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

class InwardService:
    def __init__(self, db: Session):
        self.db = db

    def _get_receiver_id(self, receiver_name: str) -> int:
        """Looks up a User ID by their full name."""
        user = self.db.execute(select(User).where(User.username == receiver_name)).scalars().first()
        
        if not user:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Receiver user '{receiver_name}' not found. Please use a valid, registered name."
            )
        return user.user_id

    # 🚀 ✅ FIXED: Added the missing create_inward_with_files method
    async def create_inward_with_files(
        self, 
        inward_data: InwardCreate, 
        files_by_index: Dict[int, List[UploadFile]], 
        creator_id: int
    ) -> Inward:
        """
        Creates a new Inward record, saves associated photos, and creates equipment records.
        This is an atomic operation: if any part fails, the entire transaction is rolled back.
        """
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
            self.db.flush() # Flush to get the new `inward_id` for relationships

            equipment_models = []
            for index, eqp_data in enumerate(inward_data.equipment_list):
                
                photo_paths = []
                if index in files_by_index:
                    for file in files_by_index[index]:
                        file_extension = os.path.splitext(file.filename)[1]
                        unique_filename = f"{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
                        
                        async with aiofiles.open(file_path, 'wb') as out_file:
                            content = await file.read()
                            await out_file.write(content)
                        
                        photo_paths.append(file_path)

                # Map the Pydantic schema to the SQLAlchemy model
                db_equipment = InwardEquipment(
                    inward_id=db_inward.inward_id,
                    nepl_id=eqp_data.nepl_id,
                    material_description=eqp_data.material_desc,
                    make=eqp_data.make,
                    model=eqp_data.model,
                    range=eqp_data.range,
                    serial_no=eqp_data.serial_no,
                    quantity=eqp_data.qty,
                    visual_inspection_notes=eqp_data.inspe_notes,
                    calibration_by=eqp_data.calibration_by,
                    supplier=eqp_data.supplier,
                    out_dc=eqp_data.out_dc,
                    in_dc=eqp_data.in_dc,
                    nextage_contract_reference=eqp_data.nextage_ref,
                    qr_code=eqp_data.qr_code,
                    barcode=eqp_data.barcode,
                    photos=photo_paths
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
            print(f"ERROR: Database error during inward creation with files: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"An internal server error occurred: {e}"
            )

    def get_all_inwards(self) -> List[Inward]:
        """Retrieves a list of all Inward records."""
        return self.db.execute(select(Inward).order_by(Inward.created_at.desc())).scalars().all()

    def get_inward_by_id(self, inward_id: int) -> Inward:
        """Retrieves a single Inward record by its primary key."""
        db_inward = self.db.get(Inward, inward_id)
        if not db_inward:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inward record not found.")
        return db_inward

    async def process_customer_notification(
        self,
        inward_id: int,
        customer_email: str,
        creator_id: int,
        background_tasks: BackgroundTasks
    ):
        """Orchestrates the entire customer notification and invitation process."""
        # ... (rest of this method is likely correct, no changes needed here)
        db_inward = self.get_inward_by_id(inward_id)
        if not db_inward.customer_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot send notification: Inward is missing customer details."
            )
        user_stmt = select(User).where(User.email == customer_email)
        existing_user = self.db.scalars(user_stmt).first()
        if existing_user:
            if existing_user.role.lower() != 'customer':
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An internal staff account already exists with this email."
                )
            if not db_inward.customer_id:
                db_inward.customer_id = existing_user.customer_id
                self.db.commit()
            await send_inward_remarks_notification_email(
                background_tasks=background_tasks,
                recipient_email=existing_user.email,
                inward_id=db_inward.inward_id,
                srf_no=db_inward.srf_no,
            )
            return {"message": f"Notification sent to existing customer {customer_email}."}
        else:
            customer_stmt = select(Customer).where(Customer.customer_details == db_inward.customer_details)
            customer = self.db.scalars(customer_stmt).first()
            if not customer:
                customer = Customer(
                    customer_details=db_inward.customer_details,
                    email=customer_email
                )
                self.db.add(customer)
                self.db.flush()
            db_inward.customer_id = customer.customer_id
            new_user = User(
                email=customer_email,
                username=customer_email,
                password_hash="",
                role='customer',
                is_active=False,
                customer_id=customer.customer_id
            )
            self.db.add(new_user)
            self.db.flush()
            invitation_token = create_invitation_token()
            new_invitation = Invitation(
                email=customer_email,
                token=invitation_token,
                customer_id=customer.customer_id,
                created_by=creator_id,
                user_to_activate_id=new_user.user_id
            )
            self.db.add(new_invitation)
            self.db.commit()
            await send_customer_invitation_email(
                background_tasks=background_tasks,
                recipient_email=customer_email,
                token=invitation_token,
                srf_no=db_inward.srf_no,
            )
            return {"message": f"Invitation sent to new customer {customer_email}."}