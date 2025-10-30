# file: backend/services/srf_services.py

# <-- FIX 1: Import the standard datetime library -->
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session, selectinload
# <-- FIX 2: Import 'func' from SQLAlchemy -->
from sqlalchemy import select, func

from fastapi import HTTPException, status

from backend.models.inward import Inward
from backend.models.srfs import Srf
from backend.models.srf_equipments import SrfEquipment
from backend.models.inward_equipments import InwardEquipment
from backend.schemas.user_schemas import User as UserSchema

class SrfService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_pending_srf_inwards(self, current_user: UserSchema) -> List[Dict[str, Any]]:
        """
        Gets inwards that are ready for SRF creation, filtered by the
        customer assigned to the currently logged-in staff member.
        """
        if not current_user.customer_id:
            return []

        stmt = (
            select(Inward)
            .options(selectinload(Inward.equipments))
            .where(
                Inward.status == 'created',
                Inward.customer_id == current_user.customer_id
            )
            .order_by(Inward.updated_at.desc())
        )
        
        inwards = self.db.scalars(stmt).all()
        
        result = [
            {
                "inward_id": inward.inward_id,
                "srf_no": inward.srf_no,
                "date": inward.date,
                "customer_details": inward.customer_details,
                "status": inward.status,
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
            for inward in inwards
        ]
        
        return result
    
    def create_srf_from_inward(self, inward_id: int, srf_data: Dict[str, Any]) -> Srf:
        """
        Creates a new SRF from a pending inward and updates the inward's status.
        """
        inward = self.db.get(Inward, inward_id)
        if not inward:
            raise HTTPException(status_code=404, detail="Inward not found")
        
        if inward.status != 'created':
            raise HTTPException(status_code=400, detail="An SRF can only be created from an inward with 'created' status.")
            
        existing_srf = self.db.scalars(select(Srf).where(Srf.inward_id == inward_id)).first()
        if existing_srf:
            raise HTTPException(status_code=400, detail="SRF already exists for this inward. Please refresh the list.")
        
        new_srf = Srf(
            inward_id=inward_id,
            srf_no=inward.srf_no,
            date=srf_data.get('date', inward.date),
            telephone=srf_data.get('telephone'),
            contact_person=srf_data.get('contact_person'),
            email=srf_data.get('email'),
            certificate_issue_name=srf_data.get('certificate_issue_name'),
            status='created'
        )
        self.db.add(new_srf)
        self.db.flush()
        
        inward_equipments = self.db.scalars(
            select(InwardEquipment).where(InwardEquipment.inward_id == inward_id)
        ).all()
        
        equipment_details_payload = srf_data.get('equipment_details', {})
        for inward_eq in inward_equipments:
            eq_payload = equipment_details_payload.get(str(inward_eq.inward_eqp_id), {})
            srf_eq = SrfEquipment(
                srf_id=new_srf.srf_id,
                inward_eqp_id=inward_eq.inward_eqp_id,
                unit=eq_payload.get('unit'),
                no_of_calibration_points=eq_payload.get('calibration_points'),
                mode_of_calibration=eq_payload.get('calibration_mode')
            )
            self.db.add(srf_eq)
            
        inward.status = 'srf_created'
        
        self.db.commit()
        self.db.refresh(new_srf)
        return new_srf
    
    def get_srf_by_id(self, srf_id: int) -> Dict[str, Any]:
        """Gets detailed information for a single SRF."""
        srf = self.db.get(Srf, srf_id)
        if not srf:
            raise HTTPException(status_code=404, detail="SRF not found")
        
        inward = self.db.get(Inward, srf.inward_id)
        
        equipment_stmt = (
            select(SrfEquipment, InwardEquipment)
            .join(InwardEquipment, SrfEquipment.inward_eqp_id == InwardEquipment.inward_eqp_id)
            .where(SrfEquipment.srf_id == srf_id)
        )
        
        equipment_details = [
            {
                "srf_eqp_id": srf_eq.srf_eqp_id,
                "inward_eqp_id": srf_eq.inward_eqp_id,
                "nepl_id": inward_eq.nepl_id,
                # Note: 'material_.description' looks like a typo. It should probably be 'material_description'
                "material_description": inward_eq.material_description,
                "make": inward_eq.make,
                "model": inward_eq.model,
                "serial_no": inward_eq.serial_no,
                "unit": srf_eq.unit,
                "no_of_calibration_points": srf_eq.no_of_calibration_points,
                "mode_of_calibration": srf_eq.mode_of_calibration,
            }
            for srf_eq, inward_eq in self.db.execute(equipment_stmt).all()
        ]
        
        return {
            "srf_id": srf.srf_id,
            "inward_id": srf.inward_id,
            "srf_no": srf.srf_no,
            "date": srf.date,
            "telephone": srf.telephone,
            "contact_person": srf.contact_person,
            "email": srf.email,
            "certificate_issue_name": srf.certificate_issue_name,
            "status": srf.status,
            "customer_details": inward.customer_details if inward else None,
            "equipments": equipment_details
        }

    def update_srf(self, srf_id: int, update_data: Dict[str, Any]):
        """Updates an existing SRF and its associated equipment details."""
        srf = self.db.get(Srf, srf_id)
        if not srf:
            raise HTTPException(status_code=404, detail="SRF not found")

        for field, value in update_data.items():
            if field != 'equipment_details' and hasattr(srf, field):
                setattr(srf, field, value)
        
        equipment_details_payload = update_data.get('equipment_details')
        if equipment_details_payload:
            srf_equipments_map = {
                eq.inward_eqp_id: eq 
                for eq in self.db.scalars(
                    select(SrfEquipment).where(SrfEquipment.srf_id == srf_id)
                ).all()
            }
            for inward_eqp_id_str, details in equipment_details_payload.items():
                inward_eqp_id = int(inward_eqp_id_str)
                srf_eq = srf_equipments_map.get(inward_eqp_id)
                if srf_eq:
                    srf_eq.unit = details.get('unit', srf_eq.unit)
                    srf_eq.no_of_calibration_points = details.get('calibration_points', srf_eq.no_of_calibration_points)
                    srf_eq.mode_of_calibration = details.get('calibration_mode', srf_eq.mode_of_calibration)
        
        self.db.commit()
        self.db.refresh(srf)
        return srf
    
    def generate_next_srf_no(self) -> int:
        """
        Generate the next SRF number following the format: YYNNN
        Where YY = last 2 digits of current year
        NNN = 3-digit sequence number starting from 001
        """
        # The 'datetime' object is now available because of the import
        current_year = datetime.now().year
        year_suffix = current_year % 100
        
        year_start = year_suffix * 1000 + 1
        year_end = year_suffix * 1000 + 999
        
        # The 'func' object is now available because of the import
        highest_srf = self.db.execute(
            select(func.max(Inward.srf_no))
            .where(Inward.srf_no.between(year_start, year_end))
        ).scalar()
        
        if highest_srf is None:
            return year_start
        else:
            next_srf = highest_srf + 1
            if next_srf > year_end:
                raise ValueError(f"SRF number limit exceeded for year {current_year}. Maximum is {year_end}")
            return next_srf
    
    def format_srf_display(self, srf_no: int) -> str:
        return str(srf_no)
    
    def validate_srf_format(self, srf_no: int) -> bool:
        if not isinstance(srf_no, int) or srf_no < 10001 or srf_no > 99999:
            return False
        
        year_part = srf_no // 1000
        sequence_part = srf_no % 1000
        
        return 0 <= year_part <= 99 and 1 <= sequence_part <= 999