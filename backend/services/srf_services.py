# backend/services/srf_services.py

from typing import List, Dict, Any
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select
from fastapi import HTTPException, status

from backend.models.inward import Inward
from backend.models.srfs import Srf
from backend.models.srf_equipments import SrfEquipment
from backend.models.inward_equipments import InwardEquipment

class SrfService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_reviewed_inwards(self) -> List[Dict[str, Any]]:
        """Get inwards with status 'reviewed' that are ready for SRF creation"""
        stmt = (
            select(Inward)
            .options(selectinload(Inward.equipments))
            .where(Inward.status == 'reviewed')
            .order_by(Inward.updated_at.desc())
        )
        
        inwards = self.db.scalars(stmt).all()
        
        result = []
        for inward in inwards:
            # Check if SRF already exists
            existing_srf = self.db.scalars(
                select(Srf).where(Srf.inward_id == inward.inward_id)
            ).first()
            
            if not existing_srf:  # Only include inwards without SRF
                result.append({
                    "inward_id": inward.inward_id,
                    "srf_no": inward.srf_no,
                    "date": inward.date,
                    "customer_details": inward.customer_details,
                    "status": inward.status,
                    "equipment_count": len(inward.equipments),
                    "equipments": [
                        {
                            "inward_eqp_id": eq.inward_eqp_id,
                            "nepl_id": eq.nepl_id,
                            "material_description": eq.material_description,
                            "make": eq.make,
                            "model": eq.model,
                            "serial_no": eq.serial_no,
                            "quantity": eq.quantity,
                            "calibration_by": eq.calibration_by,
                            "remarks": eq.remarks
                        } for eq in inward.equipments
                    ]
                })
        
        return result
    
    def create_srf_from_inward(self, inward_id: int, srf_data: Dict[str, Any]) -> Srf:
        """Create SRF from reviewed inward"""
        # Verify inward exists and is reviewed
        inward = self.db.get(Inward, inward_id)
        if not inward:
            raise HTTPException(status_code=404, detail="Inward not found")
        
        if inward.status != 'reviewed':
            raise HTTPException(status_code=400, detail="Inward must be reviewed before creating SRF")
        
        # Check if SRF already exists
        existing_srf = self.db.scalars(
            select(Srf).where(Srf.inward_id == inward_id)
        ).first()
        
        if existing_srf:
            raise HTTPException(status_code=400, detail="SRF already exists for this inward")
        
        # Create SRF
        srf = Srf(
            inward_id=inward_id,
            srf_no=inward.srf_no,
            date=srf_data.get('date', inward.date),
            telephone=srf_data.get('telephone'),
            contact_person=srf_data.get('contact_person'),
            email=srf_data.get('email'),
            certificate_issue_name=srf_data.get('certificate_issue_name'),
            calibration_frequency=srf_data.get('calibration_frequency'),
            statement_of_conformity=srf_data.get('statement_of_conformity', False),
            ref_iso_is_doc=srf_data.get('ref_iso_is_doc', False),
            ref_manufacturer_manual=srf_data.get('ref_manufacturer_manual', False),
            ref_customer_requirement=srf_data.get('ref_customer_requirement', False),
            turnaround_time=srf_data.get('turnaround_time', 7),
            remark_special_instructions=srf_data.get('remark_special_instructions'),
            status='created'
        )
        
        self.db.add(srf)
        self.db.flush()
        
        # Create SRF equipments for all inward equipments
        inward_equipments = self.db.scalars(
            select(InwardEquipment).where(InwardEquipment.inward_id == inward_id)
        ).all()
        
        for inward_eq in inward_equipments:
            srf_eq = SrfEquipment(
                srf_id=srf.srf_id,
                inward_eqp_id=inward_eq.inward_eqp_id,
                unit=srf_data.get('equipment_details', {}).get(str(inward_eq.inward_eqp_id), {}).get('unit'),
                no_of_calibration_points=srf_data.get('equipment_details', {}).get(str(inward_eq.inward_eqp_id), {}).get('calibration_points'),
                mode_of_calibration=srf_data.get('equipment_details', {}).get(str(inward_eq.inward_eqp_id), {}).get('calibration_mode')
            )
            self.db.add(srf_eq)
        
        # Update inward status to indicate SRF created
        inward.status = 'srf_created'
        
        self.db.commit()
        self.db.refresh(srf)
        
        return srf
    
    def get_srf_by_id(self, srf_id: int) -> Dict[str, Any]:
        """Get SRF details with equipment information"""
        stmt = (
            select(Srf)
            .options(selectinload(Srf.equipments))
            .where(Srf.srf_id == srf_id)
        )
        
        srf = self.db.scalars(stmt).first()
        if not srf:
            raise HTTPException(status_code=404, detail="SRF not found")
        
        # Get inward details
        inward = self.db.get(Inward, srf.inward_id)
        
        # Get equipment details with SRF equipment info
        equipment_details = []
        for srf_eq in srf.equipments:
            inward_eq = self.db.get(InwardEquipment, srf_eq.inward_eqp_id)
            equipment_details.append({
                "srf_eqp_id": srf_eq.srf_eqp_id,
                "inward_eqp_id": srf_eq.inward_eqp_id,
                "nepl_id": inward_eq.nepl_id,
                "material_description": inward_eq.material_description,
                "make": inward_eq.make,
                "model": inward_eq.model,
                "serial_no": inward_eq.serial_no,
                "quantity": inward_eq.quantity,
                "unit": srf_eq.unit,
                "no_of_calibration_points": srf_eq.no_of_calibration_points,
                "mode_of_calibration": srf_eq.mode_of_calibration,
                "remarks": inward_eq.remarks
            })
        
        return {
            "srf_id": srf.srf_id,
            "inward_id": srf.inward_id,
            "srf_no": srf.srf_no,
            "date": srf.date,
            "telephone": srf.telephone,
            "contact_person": srf.contact_person,
            "email": srf.email,
            "certificate_issue_name": srf.certificate_issue_name,
            "calibration_frequency": srf.calibration_frequency,
            "statement_of_conformity": srf.statement_of_conformity,
            "ref_iso_is_doc": srf.ref_iso_is_doc,
            "ref_manufacturer_manual": srf.ref_manufacturer_manual,
            "ref_customer_requirement": srf.ref_customer_requirement,
            "turnaround_time": srf.turnaround_time,
            "remark_special_instructions": srf.remark_special_instructions,
            "status": srf.status,
            "customer_details": inward.customer_details if inward else None,
            "equipments": equipment_details
        }