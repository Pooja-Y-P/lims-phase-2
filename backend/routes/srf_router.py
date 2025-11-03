# file: backend/api/v1/endpoints/srf.py

"""
API router for managing Service Request Forms (SRFs).

Provides endpoints for creating, retrieving, updating, and deleting SRFs
and their associated equipment details.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional

# Import schemas, models, and dependencies
from ..schemas.srf_schemas import Srf, SrfCreate, SrfDetailUpdate, SrfSummary
from .. import models
from ..db import get_db

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
def get_srfs(db: Session = Depends(get_db), inward_status: Optional[str] = Query(None)):
    """
    Retrieves a list of SRF summaries.
    Optionally filters SRFs based on the status of their related Inward record.
    
    Example: GET /api/srfs?inward_status=created
    """
    try:
        query = (
            db.query(models.Srf)
            .join(models.Inward, models.Srf.inward_id == models.Inward.inward_id)
            .options(joinedload(models.Srf.inward).joinedload(models.Inward.customer))
        )

        if inward_status:
            query = query.filter(models.Inward.status == inward_status)

        srfs_from_db = query.order_by(models.Srf.srf_id.desc()).all()

        # Map ORM models to the SrfSummary schema, including the customer name
        def create_summary(srf: models.Srf) -> SrfSummary:
            summary = SrfSummary.model_validate(srf)
            if srf.inward and srf.inward.customer:
                summary.customer_name = srf.inward.customer.customer_details
            return summary

        return [create_summary(srf) for srf in srfs_from_db]

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")

# =====================================================================
# GET: Single SRF (Detail View)
# =====================================================================
@router.get("/{srf_id}", response_model=Srf)
def get_srf_by_id(srf_id: int, db: Session = Depends(get_db)):
    """Retrieve a single SRF with full nested data."""
    srf = get_srf_with_full_details(srf_id, db)
    if not srf:
        raise HTTPException(status_code=404, detail=f"SRF with ID {srf_id} not found")
    return srf

# =====================================================================
# POST: Create SRF
# =====================================================================
@router.post("/", response_model=Srf, status_code=201)
def create_srf(srf_data: SrfCreate, db: Session = Depends(get_db)):
    """
    Creates a new SRF and its associated equipment details in a single transaction.
    """
    # 1. Validate the parent Inward record exists
    inward = db.query(models.Inward).filter(models.Inward.inward_id == srf_data.inward_id).first()
    if not inward:
        raise HTTPException(status_code=404, detail=f"Inward record with ID {srf_data.inward_id} not found.")

    # 2. Separate equipment data from the main SRF data
    srf_payload = srf_data.model_dump(exclude_unset=True)
    equipment_payloads = srf_payload.pop('equipments', [])

    # 3. Create the main Srf object
    new_srf = models.Srf(**srf_payload)
    
    try:
        db.add(new_srf)
        db.flush()  # Assigns a primary key (srf_id) to new_srf without committing

        # 4. If equipment data is present, create the SrfEquipment objects
        if equipment_payloads:
            for eq_data in equipment_payloads:
                # Security check: Ensure the equipment belongs to the correct inward
                inward_eq_exists = db.query(models.InwardEquipment.inward_eqp_id).filter(
                    models.InwardEquipment.inward_eqp_id == eq_data['inward_eqp_id'],
                    models.InwardEquipment.inward_id == new_srf.inward_id
                ).first()
                if not inward_eq_exists:
                    continue  # Skip this equipment if it doesn't belong to the inward

                srf_eq = models.SrfEquipment(
                    srf_id=new_srf.srf_id,  # Link to the newly flushed SRF
                    inward_eqp_id=eq_data['inward_eqp_id'],
                    unit=eq_data.get('unit'),
                    no_of_calibration_points=eq_data.get('no_of_calibration_points'),
                    mode_of_calibration=eq_data.get('mode_of_calibration')
                )
                db.add(srf_eq)

        db.commit() # Commit the entire transaction
        
        # Return the complete, newly created object
        return get_srf_with_full_details(new_srf.srf_id, db)

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create SRF due to a database error: {e}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during SRF creation: {e}")

# =====================================================================
# PUT: Update SRF
# =====================================================================
@router.put("/{srf_id}", response_model=Srf)
def update_srf(srf_id: int, srf_update_data: SrfDetailUpdate, db: Session = Depends(get_db)):
    """
    Updates an SRF and its nested equipment details.
    This can create SrfEquipment records if they don't exist yet.
    """
    srf_to_update = get_srf_with_full_details(srf_id, db)
    if not srf_to_update or not srf_to_update.inward:
        raise HTTPException(
            status_code=404, 
            detail=f"SRF with ID {srf_id} not found or has no associated inward record."
        )

    try:
        # A. Update top-level SRF fields
        update_data = srf_update_data.model_dump(exclude={'equipments'}, exclude_unset=True)
        for key, value in update_data.items():
            if hasattr(srf_to_update, key):
                setattr(srf_to_update, key, value)

        # B. Update nested equipment data
        if srf_update_data.equipments:
            # Create a map for efficient lookup of inward equipment
            inward_equipments_map = {eq.inward_eqp_id: eq for eq in srf_to_update.inward.equipments}
            
            for eq_update in srf_update_data.equipments:
                target_inward_eq = inward_equipments_map.get(eq_update.inward_eqp_id)
                if target_inward_eq:
                    # If SrfEquipment doesn't exist for this item, create it
                    if not target_inward_eq.srf_equipment:
                        target_inward_eq.srf_equipment = models.SrfEquipment(
                            srf_id=srf_id, 
                            inward_eqp_id=target_inward_eq.inward_eqp_id
                        )
                    
                    # Update fields on the (now guaranteed to exist) srf_equipment object
                    update_eq_data = eq_update.model_dump(exclude={'inward_eqp_id'}, exclude_unset=True)
                    for key, value in update_eq_data.items():
                        if hasattr(target_inward_eq.srf_equipment, key):
                            setattr(target_inward_eq.srf_equipment, key, value)
        
        db.commit()
        
        # Return the fully updated object
        return get_srf_with_full_details(srf_id, db)

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while updating SRF: {e}")

# =====================================================================
# DELETE: SRF
# =====================================================================
@router.delete("/{srf_id}", status_code=204)
def delete_srf(srf_id: int, db: Session = Depends(get_db)):
    """
    Deletes an SRF. Cascade rules in the database model will handle deletion
    of related SrfEquipment records.
    """
    srf_to_delete = db.query(models.Srf).filter(models.Srf.srf_id == srf_id).first()
    if not srf_to_delete:
        raise HTTPException(status_code=404, detail=f"SRF with ID {srf_id} not found")

    try:
        db.delete(srf_to_delete)
        db.commit()
        return Response(status_code=204) # HTTP 204 No Content on successful deletion
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete SRF: {e}")

# =====================================================================
# GET SRFs by Customer ID (For Customer Portal)
# =====================================================================
@router.get("/customer/srfs/{user_id}", response_model=List[Srf])
def get_srfs_by_customer(user_id: int, db: Session = Depends(get_db)):
    """
    Fetch all SRFs for a customer, looked up via their user_id.
    """
    try:
        user = db.query(models.User).filter(models.User.user_id == user_id).first()
        if not user or user.customer_id is None:
            raise HTTPException(status_code=404, detail="User not found or not linked to a customer.")
        
        inwards = db.query(models.Inward).filter(models.Inward.customer_id == user.customer_id).all()
        inward_ids = [inward.inward_id for inward in inwards]
        if not inward_ids:
            return [] # No inwards for this customer, so no SRFs

        # Use the helper function to build the query, then filter and execute
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
        # Log the specific database error for debugging
        print(f"Database error in get_srfs_by_customer: {e}")
        raise HTTPException(status_code=500, detail="A database error occurred.")
    except Exception as e:
        print(f"An unexpected error occurred in get_srfs_by_customer: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")