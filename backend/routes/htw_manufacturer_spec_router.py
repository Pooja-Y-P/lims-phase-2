# backend/routes/htw_manufacturer_spec_router.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime

from ..schemas.htw_manufacturer_spec_schemas import (
    HTWManufacturerSpecCreate,
    HTWManufacturerSpecUpdate,
    HTWManufacturerSpecResponse
)
from .. import models
from ..db import get_db
from ..auth import get_current_user
from ..schemas.user_schemas import UserResponse

router = APIRouter(
    prefix="/htw-manufacturer-specs",
    tags=["HTW Manufacturer Specifications"]
)


# =====================================================================
# GET: All HTW Manufacturer Specs (List View)
# =====================================================================
@router.get("/", response_model=List[HTWManufacturerSpecResponse])
def get_htw_manufacturer_specs(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None)
):
    """
    Retrieves a list of HTW Manufacturer Specifications.
    Only returns specs for Hydraulic Torque Wrench equipment type.
    """
    try:
        query = db.query(models.HTWManufacturerSpec)
        
        # Filter by active status if provided
        if is_active is not None:
            query = query.filter(models.HTWManufacturerSpec.is_active == is_active)
        
        # Order by created_at descending (newest first)
        query = query.order_by(models.HTWManufacturerSpec.created_at.desc())
        
        # Apply pagination
        specs = query.offset(skip).limit(limit).all()
        
        return specs
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# GET: Single HTW Manufacturer Spec (Detail View)
# =====================================================================
@router.get("/{spec_id}", response_model=HTWManufacturerSpecResponse)
def get_htw_manufacturer_spec(
    spec_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieves a single HTW Manufacturer Spec by ID.
    """
    spec = db.query(models.HTWManufacturerSpec).filter(
        models.HTWManufacturerSpec.id == spec_id
    ).first()
    
    if not spec:
        raise HTTPException(
            status_code=404,
            detail=f"HTW Manufacturer Spec with ID {spec_id} not found"
        )
    
    return spec


# =====================================================================
# POST: Create HTW Manufacturer Spec
# =====================================================================
@router.post("/", response_model=HTWManufacturerSpecResponse, status_code=201)
def create_htw_manufacturer_spec(
    spec_data: HTWManufacturerSpecCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Creates a new HTW Manufacturer Spec.
    Only works for Hydraulic Torque Wrench equipment type.
    """
    try:
        # Create new spec instance
        new_spec = models.HTWManufacturerSpec(**spec_data.model_dump())
        
        db.add(new_spec)
        db.commit()
        db.refresh(new_spec)
        
        return new_spec
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# PUT: Update HTW Manufacturer Spec
# =====================================================================
@router.put("/{spec_id}", response_model=HTWManufacturerSpecResponse)
def update_htw_manufacturer_spec(
    spec_id: int,
    spec_data: HTWManufacturerSpecUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Updates an existing HTW Manufacturer Spec.
    """
    try:
        # Find the spec
        spec = db.query(models.HTWManufacturerSpec).filter(
            models.HTWManufacturerSpec.id == spec_id
        ).first()
        
        if not spec:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Manufacturer Spec with ID {spec_id} not found"
            )
        
        # Update fields
        update_data = spec_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(spec, field, value)
        
        # Update the updated_at timestamp
        spec.updated_at = datetime.now()
        
        db.commit()
        db.refresh(spec)
        
        return spec
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# PATCH: Update HTW Manufacturer Spec Status
# =====================================================================
@router.patch("/{spec_id}/status", response_model=HTWManufacturerSpecResponse)
def update_htw_manufacturer_spec_status(
    spec_id: int,
    is_active: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Updates the active status of an HTW Manufacturer Spec.
    """
    try:
        spec = db.query(models.HTWManufacturerSpec).filter(
            models.HTWManufacturerSpec.id == spec_id
        ).first()
        
        if not spec:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Manufacturer Spec with ID {spec_id} not found"
            )
        
        spec.is_active = is_active
        spec.updated_at = datetime.now()
        
        db.commit()
        db.refresh(spec)
        
        return spec
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# DELETE: Delete HTW Manufacturer Spec
# =====================================================================
@router.delete("/{spec_id}", status_code=204)
def delete_htw_manufacturer_spec(
    spec_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Deletes an HTW Manufacturer Spec.
    """
    try:
        spec = db.query(models.HTWManufacturerSpec).filter(
            models.HTWManufacturerSpec.id == spec_id
        ).first()
        
        if not spec:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Manufacturer Spec with ID {spec_id} not found"
            )
        
        db.delete(spec)
        db.commit()
        
        return None
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")

