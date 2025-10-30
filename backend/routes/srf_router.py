from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional

# Import schemas and models
from ..schemas.srf_schemas import Srf, SrfCreate, SrfDetailUpdate, SrfSummary
from .. import models
from ..db import get_db
# from ..auth import get_current_user # Uncomment if you use auth

router = APIRouter(
    prefix="/srfs",
    tags=["SRFs"]
)

# =====================================================================
# Helper Function (No Changes)
# =====================================================================
def get_srf_with_full_details(srf_id: int, db: Session) -> Optional[models.Srf]:
    """Fetch an SRF with all its nested relationships."""
    return db.query(models.Srf).options(
        joinedload(models.Srf.inward).joinedload(models.Inward.customer),
        joinedload(models.Srf.inward)
        .joinedload(models.Inward.equipments)
        .joinedload(models.InwardEquipment.srf_equipment)
    ).filter(models.Srf.srf_id == srf_id).first()

# =====================================================================
# GET: All SRFs (Admin / Engineer / Customer Portal)
# =====================================================================
@router.get("/", response_model=List[SrfSummary])
def get_srfs(db: Session = Depends(get_db), inward_status: Optional[str] = Query(None)):
    """
    Retrieves a list of SRFs.
    Optionally filters SRFs based on the related Inward status.
    
    Example:
        GET /api/srfs?inward_status=created
    """
    try:
        # Base query joining SRF with Inward to allow filtering
        query = (
            db.query(models.Srf)
            .join(models.Inward, models.Srf.inward_id == models.Inward.inward_id)
            .options(joinedload(models.Srf.inward).joinedload(models.Inward.customer))
        )

        # ✅ Filter by inward.status if provided
        if inward_status:
            query = query.filter(models.Inward.status == inward_status)

        srfs_from_db = query.order_by(models.Srf.srf_id.desc()).all()

        # Convert ORM models into summary schema
        def create_summary(srf):
            summary = SrfSummary.model_validate(srf)
            if srf.inward and srf.inward.customer:
                summary.customer_name = srf.inward.customer.customer_details
            return summary

        return [create_summary(srf) for srf in srfs_from_db]

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")

# =====================================================================
# GET: Single SRF (Full Details)
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
    """Creates a new SRF."""
    inward = db.query(models.Inward).filter(models.Inward.inward_id == srf_data.inward_id).first()
    if not inward:
        raise HTTPException(status_code=404, detail=f"Inward record with ID {srf_data.inward_id} not found.")

    new_srf = models.Srf(**srf_data.model_dump())
    try:
        db.add(new_srf)
        db.commit()
        db.refresh(new_srf)
        return new_srf
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create SRF: {e}")

# =====================================================================
# PUT: Update SRF (Enhanced to handle remarks)
# =====================================================================
@router.put("/{srf_id}", response_model=Srf)
def update_srf(srf_id: int, srf_update_data: SrfDetailUpdate, db: Session = Depends(get_db)):
    """
    Updates an SRF — handles special instructions, calibration frequency,
    admin fields, remarks, and nested equipment updates.
    """
    srf_to_update = get_srf_with_full_details(srf_id, db)
    if not srf_to_update or not srf_to_update.inward:
        raise HTTPException(
            status_code=404, 
            detail=f"SRF with ID {srf_id} not found or has no associated inward record."
        )

    try:
        # --- A. Handle Calibration Frequency ---
        if hasattr(srf_update_data, "specified_frequency"):
            # Older frontend compatibility
            if srf_update_data.calibration_frequency == "Specify":
                srf_to_update.calibration_frequency = srf_update_data.specified_frequency  # type: ignore
            elif srf_update_data.calibration_frequency is not None:
                srf_to_update.calibration_frequency = srf_update_data.calibration_frequency  # type: ignore
        else:
            if srf_update_data.calibration_frequency is not None:
                srf_to_update.calibration_frequency = srf_update_data.calibration_frequency  # type: ignore

        # --- B. Update other SRF fields (including remarks) ---
        update_data = srf_update_data.model_dump(
            exclude={'equipments', 'calibration_frequency', 'specified_frequency'},
            exclude_unset=True,
            by_alias=True
        )

        # ✅ Explicitly handle remarks
        if 'remarks' in update_data:
            srf_to_update.remarks = update_data['remarks']

        # ✅ Generic update for remaining fields
        for key, value in update_data.items():
            if hasattr(srf_to_update, key) and key != 'remarks':
                setattr(srf_to_update, key, value)

        # --- C. Update nested equipment data ---
        if srf_update_data.equipments:
            inward_equipments_map = {eq.inward_eqp_id: eq for eq in srf_to_update.inward.equipments}
            for eq_update in srf_update_data.equipments:
                target_inward_eq = inward_equipments_map.get(eq_update.inward_eqp_id)
                if target_inward_eq:
                    if not target_inward_eq.srf_equipment:
                        target_inward_eq.srf_equipment = models.SrfEquipment(srf_id=srf_id)

                    update_eq_data = eq_update.model_dump(exclude={'inward_eqp_id'}, exclude_unset=True)
                    for key, value in update_eq_data.items():
                        if hasattr(target_inward_eq.srf_equipment, key):
                            setattr(target_inward_eq.srf_equipment, key, value)

        # --- D. Commit changes ---
        db.commit()
        db.refresh(srf_to_update)

        return get_srf_with_full_details(srf_id, db)

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error while updating SRF: {e}")


# =====================================================================
# DELETE: SRF
# =====================================================================
@router.delete("/{srf_id}", status_code=204)
def delete_srf(srf_id: int, db: Session = Depends(get_db)):
    """Deletes an SRF. Returns HTTP 204 on success."""
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
@router.get("/customer/srfs/{user_id}", response_model=List[Srf])
def get_srfs_by_customer(user_id: int, db: Session = Depends(get_db)):
    """
    Fetch all SRFs for a customer, looked up via their user_id.
    """
    try:
        # ✅ FINAL FIX: Query the 'User' model using the correct column name: 'user_id'.
        user = db.query(models.User).filter(models.User.user_id == user_id).first()
       
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
           
        # This assumes your 'User' model has a 'customer_id' property.
        # If the relationship is named differently (e.g., user.customer.id), adjust accordingly.
        actual_customer_id = user.customer_id
 
        if actual_customer_id is None:
            # Handle cases where a user might not be linked to a customer
            return []
 
        # Use the correct customer_id to find the Inward records.
        inwards = db.query(models.Inward).filter(models.Inward.customer_id == actual_customer_id).all()
       
        inward_ids = [inward.inward_id for inward in inwards]
 
        if not inward_ids:
            return []
 
        # The rest of your logic is correct.
        srfs = (
            db.query(models.Srf)
            .options(
                joinedload(models.Srf.inward)
                .joinedload(models.Inward.customer),
                joinedload(models.Srf.inward)
                .joinedload(models.Inward.equipments)
                .joinedload(models.InwardEquipment.srf_equipment)
            )
            .filter(models.Srf.inward_id.in_(inward_ids))
            .order_by(models.Srf.srf_id.desc())
            .all()
        )
        return srfs
   
    except Exception as e:
        print(f"An error occurred in get_srfs_by_customer: {e}")
        raise HTTPException(status_code=500, detail="An internal server error occurred.")
 