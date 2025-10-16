# backend/services/inward_services.py

from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status, UploadFile
import aiofiles
import os
import uuid

# Model and Schema imports
from backend.models.inward import Inward
from backend.models.inward_equipments import InwardEquipment
from backend.models.users import User
from backend.schemas.inward_schemas import InwardCreate

# Define a directory to save uploaded images
UPLOAD_DIRECTORY = "uploads/inward_photos"
os.makedirs(UPLOAD_DIRECTORY, exist_ok=True)

class InwardService:
    """Service layer for Inward and InwardEquipment management."""
    
    def __init__(self, db: Session):
        self.db = db

    def _get_receiver_id(self, receiver_name: str) -> int:
        """Looks up a User ID by their full name."""
        user = self.db.execute(select(User).where(User.full_name == receiver_name)).scalars().first()
        
        if not user:
             raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, 
                detail=f"Receiver user '{receiver_name}' not found. Please use a valid, registered name."
            )
        return user.user_id

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
            self.db.flush() # Flush to get the new `inward_id` for file naming

            equipment_models = []
            for index, eqp_data in enumerate(inward_data.equipment_list):
                
                photo_paths = []
                if index in files_by_index:
                    for file in files_by_index[index]:
                        # Generate a unique filename using UUID to prevent collisions
                        file_extension = os.path.splitext(file.filename)[1]
                        unique_filename = f"{uuid.uuid4()}{file_extension}"
                        file_path = os.path.join(UPLOAD_DIRECTORY, unique_filename)
                        
                        # Asynchronously write the file content to the disk
                        async with aiofiles.open(file_path, 'wb') as out_file:
                            content = await file.read()
                            await out_file.write(content)
                        
                        # Store the relative path to be saved in the database
                        photo_paths.append(file_path)

                # Map frontend schema to the database model
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
                    photos=photo_paths  # Add the list of saved photo paths
                )
                equipment_models.append(db_equipment)
            
            self.db.add_all(equipment_models)
            
            self.db.commit()
            self.db.refresh(db_inward) # Refresh to load relationships
            
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