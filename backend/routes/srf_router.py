# This file contains the FastAPI router for SRF-related operations.

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
 
# Import schemas, models, and dependencies
from ..schemas.srf_schemas import Srf, SrfCreate, SrfDetailUpdate, SrfSummary, InwardListSummary
from .. import models
from ..db import get_db
from ..services.srf_services import SrfService
from ..auth import get_current_user, check_staff_role
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
def get_srfs(db: Session = Depends(get_db), inward_status: Optional[str] = Query(None)):
    """
    Retrieves a list of SRF summaries.
    Updated to include inward details (Customer DC No).
    """
    try:
        # 1. Query Database
        query = (
            db.query(models.Srf)
            .join(models.Inward, models.Srf.inward_id == models.Inward.inward_id)
            .options(joinedload(models.Srf.inward).joinedload(models.Inward.customer))
        )
 
        if inward_status:
            query = query.filter(models.Inward.status == inward_status)
 
        srfs_from_db = query.order_by(models.Srf.srf_id.desc()).all()
 
        # 2. Helper to format response
        def create_summary(srf: models.Srf) -> SrfSummary:
            summary = SrfSummary.model_validate(srf, from_attributes=True)
           
            # CRITICAL FIX: Manually attach the inward object as InwardListSummary
            if srf.inward:
                # Create InwardListSummary from the inward model
                summary.inward = InwardListSummary(
                    inward_id=srf.inward.inward_id,          # ✅ required
                    status=srf.inward.status, 
                    customer_dc_no=srf.inward.customer_dc_no
                )
               
                # Handle SRF No conversion
                if srf.inward.srf_no is not None:
                    summary.srf_no = str(srf.inward.srf_no)
               
                # Attach Customer Name
                if srf.inward.customer:
                    summary.customer_name = srf.inward.customer.customer_details
           
            return summary

        return [create_summary(srf) for srf in srfs_from_db]

    except SQLAlchemyError as e:
        print(f"Database error in get_srfs: {e}")
        raise HTTPException(status_code=500, detail=f"Database query failed: {e}")
    except Exception as e:
        print(f"Unexpected error in get_srfs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
 

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
    print(f"[INFO] Received update request for SRF ID: {srf_id}")
    
    srf_to_update = get_srf_with_full_details(srf_id, db)
    if not srf_to_update or not srf_to_update.inward:
        print(f"[ERROR] SRF not found or has no associated inward. SRF ID: {srf_id}")
        raise HTTPException(
            status_code=404,
            detail=f"SRF with ID {srf_id} not found or has no associated inward record."
        )

    try:
        # Exclude srf_no and inward_id to prevent DB Integer Error
        update_data = srf_update_data.model_dump(
            exclude={'equipments', 'srf_no', 'inward_id'}, 
            exclude_unset=True
        )
        print(f"[INFO] Update data to apply on SRF: {update_data}")

        # --- Update SRF fields ---
        for key, value in update_data.items():
            if hasattr(srf_to_update, key):
                setattr(srf_to_update, key, value)
                print(f"[INFO] Updated SRF field: {key} = {value}")

        # --- Update inward status if provided ---
        if 'status' in srf_update_data.model_dump() and srf_update_data.status:
            old_status = srf_to_update.inward.status
            srf_to_update.inward.status = "srf_created"
            print(f"[INFO] Updated inward.status: {old_status} → {srf_update_data.status}")

        # --- Update SRF Equipment ---
        if srf_update_data.equipments:
            print(f"[INFO] Updating {len(srf_update_data.equipments)} equipment records")
            inward_equipments_map = {eq.inward_eqp_id: eq for eq in srf_to_update.inward.equipments}
           
            for eq_update in srf_update_data.equipments:
                target_inward_eq = inward_equipments_map.get(eq_update.inward_eqp_id)
                if target_inward_eq:
                    if not target_inward_eq.srf_equipment:
                        target_inward_eq.srf_equipment = models.SrfEquipment(
                            srf_id=srf_id,
                            inward_eqp_id=target_inward_eq.inward_eqp_id
                        )
                        print(f"[INFO] Created new SrfEquipment for inward_eqp_id {target_inward_eq.inward_eqp_id}")

                    update_eq_data = eq_update.model_dump(exclude={'inward_eqp_id'}, exclude_unset=True)
                    for key, value in update_eq_data.items():
                        if hasattr(target_inward_eq.srf_equipment, key):
                            setattr(target_inward_eq.srf_equipment, key, value)
                            print(f"[INFO] Updated equipment field: {key} = {value} for inward_eqp_id {target_inward_eq.inward_eqp_id}")

        db.commit()
        print(f"[SUCCESS] SRF ID {srf_id} updated successfully and committed to DB")
        return get_srf_with_full_details(srf_id, db)

    except SQLAlchemyError as e:
        db.rollback()
        print(f"[DB ERROR] {e}")
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

# =====================================================================
# Export Endpoints for SRF Management Sections
# =====================================================================

@router.get("/export/pending")
async def export_pending_srf_section(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(check_staff_role)
):
    """Export Pending SRF Creation section data."""
    srf_service = SrfService(db)
    excel_stream = srf_service.export_pending_srf_section(
        start_date=start_date,
        end_date=end_date,
        search_term=search
    )
    from datetime import datetime
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"pending_srf_export_{timestamp}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/{status_filter}")
async def export_srf_section(
    status_filter: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(check_staff_role)
):
    """Export SRF section data by status (customer_review, approved, rejected)."""
    if status_filter not in ["customer_review", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status filter. Must be: customer_review, approved, or rejected")
    
    srf_service = SrfService(db)
    excel_stream = srf_service.export_srf_section_by_status(
        status_filter=status_filter,
        start_date=start_date,
        end_date=end_date,
        search_term=search
    )
    from datetime import datetime
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"srf_{status_filter}_export_{timestamp}.xlsx"
    return StreamingResponse(
        excel_stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )