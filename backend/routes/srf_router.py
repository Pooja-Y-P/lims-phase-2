# This file contains the FastAPI router for SRF-related operations.

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
 
# Import schemas, models, and dependencies
from ..schemas.srf_schemas import Srf, SrfCreate, SrfDetailUpdate, SrfSummary
from .. import models
from ..db import get_db
from ..services.srf_services import SrfService
from ..auth import get_current_user
from ..schemas.user_schemas import UserResponse

router = APIRouter(
    prefix="/srfs",
    tags=["SRFs"]
)
 
# =====================================================================
# Helper Function
# =====================================================================
def get_srf_with_full_details(srf_id: int, db: Session) -> Optional[models.Srf]:
    """
    Centralized function to fetch an SRF with all its nested relationships
    eagerly loaded for a complete response object.
    """
    return db.query(models.Srf).options(
        joinedload(models.Srf.inward).joinedload(models.Inward.customer),
        joinedload(models.Srf.inward)
        .joinedload(models.Inward.equipments)
        .joinedload(models.InwardEquipment.srf_equipment)
    ).filter(models.Srf.srf_id == srf_id).first()
 
# =====================================================================
# GET: All SRFs (List View)
# =====================================================================
@router.get("/", response_model=List[SrfSummary])
def get_srfs(
    db: Session = Depends(get_db),
    status: Optional[str] = Query(None)
):
    """
    Returns SRF summaries.
    """
    try:
        query = (
            db.query(models.Srf)
            .join(models.Inward, models.Srf.inward_id == models.Inward.inward_id)
            .options(joinedload(models.Srf.inward).joinedload(models.Inward.customer))
            .filter(models.Inward.status == "updated")
        )

        if status:
            query = query.filter(models.Srf.status == status)

        srfs_from_db = query.order_by(models.Srf.srf_id.desc()).all()

        # FIX: Manually construct SrfSummary to avoid Pydantic validation error
        # due to type mismatch between DB srf_no (int) and Schema srf_no (str).
        def create_summary(srf: models.Srf) -> SrfSummary:
            # Determine the string SRF number to display
            display_srf_no = str(srf.srf_no) # Default to the int converted to string
            
            # If inward exists, prefer the Inward's SRF No (e.g., "NEPL25006")
            if srf.inward and srf.inward.srf_no:
                display_srf_no = str(srf.inward.srf_no)
            elif srf.nepl_srf_no:
                # Fallback to NEPL ID from SRF table
                display_srf_no = srf.nepl_srf_no

            customer_name = None
            if srf.inward and srf.inward.customer:
                customer_name = srf.inward.customer.customer_details

            return SrfSummary(
                srf_id=srf.srf_id,
                srf_no=display_srf_no,
                date=srf.date,
                status=srf.status,
                customer_name=customer_name
            )

        return [create_summary(srf) for srf in srfs_from_db]

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")

# =====================================================================
# GET: Single SRF (Detail View)
# =====================================================================
@router.get("/{srf_id}", response_model=Srf)
def get_srf_by_id(srf_id: int, db: Session = Depends(get_db)):
    srf = get_srf_with_full_details(srf_id, db)
    if not srf:
        raise HTTPException(status_code=404, detail=f"SRF with ID {srf_id} not found")
    return srf
 
# =====================================================================
# POST: Create SRF
# =====================================================================
@router.post("/", response_model=Srf, status_code=201)
def create_srf(srf_data: SrfCreate, db: Session = Depends(get_db)):
    try:
        srf_service = SrfService(db)
        new_srf = srf_service.create_srf_from_inward(
            inward_id=srf_data.inward_id,
            srf_data=srf_data.model_dump()
        )
        return get_srf_with_full_details(new_srf.srf_id, db)
 
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"An unexpected error occurred in create_srf endpoint: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")
 
# =====================================================================
# PUT: Update SRF
# =====================================================================
@router.put("/{srf_id}", response_model=Srf)
def update_srf(srf_id: int, srf_update_data: SrfDetailUpdate, db: Session = Depends(get_db)):
    srf_to_update = get_srf_with_full_details(srf_id, db)
    if not srf_to_update or not srf_to_update.inward:
        raise HTTPException(
            status_code=404,
            detail=f"SRF with ID {srf_id} not found or has no associated inward record."
        )
 
    try:
        update_data = srf_update_data.model_dump(exclude={'equipments'}, exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(srf_to_update, key):
                setattr(srf_to_update, key, value)
 
        if srf_update_data.equipments:
            inward_equipments_map = {eq.inward_eqp_id: eq for eq in srf_to_update.inward.equipments}
           
            for eq_update in srf_update_data.equipments:
                target_inward_eq = inward_equipments_map.get(eq_update.inward_eqp_id)
                if target_inward_eq:
                    if not target_inward_eq.srf_equipment:
                        target_inward_eq.srf_equipment = models.SrfEquipment(
                            srf_id=srf_id,
                            inward_eqp_id=target_inward_eq.inward_eqp_id
                        )
                   
                    update_eq_data = eq_update.model_dump(exclude={'inward_eqp_id'}, exclude_unset=True)
                    for key, value in update_eq_data.items():
                        if hasattr(target_inward_eq.srf_equipment, key):
                            setattr(target_inward_eq.srf_equipment, key, value)
       
        db.commit()
        return get_srf_with_full_details(srf_id, db)
 
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while updating SRF: {e}")
 
# =====================================================================
# DELETE: SRF
# =====================================================================
@router.delete("/{srf_id}", status_code=204)
def delete_srf(srf_id: int, db: Session = Depends(get_db)):
    srf_to_delete = db.query(models.Srf).filter(models.Srf.srf_id == srf_id).first()
    if not srf_to_delete:
        raise HTTPException(status_code=404, detail=f"SRF with ID {srf_id} not found")
 
    try:
        db.delete(srf_to_delete)
        db.commit()
        return Response(status_code=204)
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete SRF: {e}")
 
# =====================================================================
# GET SRFs by Customer ID
# =====================================================================
@router.get("/customer/", response_model=List[Srf])
def get_srfs_for_current_customer(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        if current_user.customer_id is None:
            raise HTTPException(status_code=403, detail="User is not linked to a customer.")
       
        inwards = db.query(models.Inward).filter(models.Inward.customer_id == current_user.customer_id).all()
        inward_ids = [inward.inward_id for inward in inwards]
        
        if not inward_ids:
            return []

        srfs = (
            db.query(models.Srf)
            .options(
                joinedload(models.Srf.inward).joinedload(models.Inward.customer),
                joinedload(models.Srf.inward)
                .joinedload(models.Inward.equipments)
                .joinedload(models.InwardEquipment.srf_equipment)
            )
            .filter(models.Srf.inward_id.in_(inward_ids))
            .order_by(models.Srf.srf_id.desc())
            .all()
        )
        return srfs
   
    except SQLAlchemyError as e:
        print(f"Database error in get_srfs_for_current_customer: {e}")
        raise HTTPException(status_code=500, detail="A database error occurred.")
    except Exception as e:
        print(f"An unexpected error occurred in get_srfs_for_current_customer: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")