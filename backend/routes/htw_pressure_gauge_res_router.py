# backend/routes/htw_pressure_gauge_res_router.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
import logging

from ..db import get_db
from .. import models
from ..schemas.htw_pressure_gauge_resolution import (
    HTWPressureGaugeResolutionResponse,
    HTWPressureGaugeResolutionCreate  # Ensure this schema is imported
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/htw-pressure-gauge-resolutions",
    tags=["HTW Pressure Gauge Resolution"]
)


# =====================================================================
# GET: Active Pressure Gauge Resolutions
# =====================================================================
@router.get("/", response_model=List[HTWPressureGaugeResolutionResponse])
def get_pressure_gauge_resolutions(
    db: Session = Depends(get_db),
    unit: Optional[str] = Query(None, description="Filter by unit")
):
    """
    Retrieves all active HTW Pressure Gauge Resolutions.
    Returns pressure and unit values.
    Optionally filters by unit if provided.
    """
    try:
        query = (
            db.query(models.HTWPressureGaugeResolution)
            # You might want to remove this filter if you want to see inactive items in the list to toggle them back
            # .filter(models.HTWPressureGaugeResolution.is_active == True) 
        )
        
        if unit:
            query = query.filter(
                models.HTWPressureGaugeResolution.unit.isnot(None),
                models.HTWPressureGaugeResolution.unit == unit.strip()
            )
        
        resolutions = query.order_by(models.HTWPressureGaugeResolution.pressure.asc()).all()
        
        # Convert to response format
        result = []
        for res in resolutions:
            pressure_value = float(res.pressure) if res.pressure is not None else None
            result.append(HTWPressureGaugeResolutionResponse(
                id=res.id,
                pressure=pressure_value,
                unit=res.unit,
                valid_upto=res.valid_upto,
                is_active=res.is_active
            ))
        
        return result

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_pressure_gauge_resolutions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Error in get_pressure_gauge_resolutions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# GET: Unique Units
# =====================================================================
@router.get("/units", response_model=List[str])
def get_unique_units(
    db: Session = Depends(get_db)
):
    try:
        units = (
            db.query(models.HTWPressureGaugeResolution.unit)
            .filter(models.HTWPressureGaugeResolution.is_active == True)
            .distinct()
            .order_by(models.HTWPressureGaugeResolution.unit.asc())
            .all()
        )
        return [unit[0] for unit in units if unit[0]]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# =====================================================================
# POST: Create Pressure Gauge Resolution
# =====================================================================
@router.post("/", response_model=HTWPressureGaugeResolutionResponse, status_code=201)
def create_pressure_gauge_resolution(
    resolution_data: HTWPressureGaugeResolutionCreate,
    db: Session = Depends(get_db)
):
    try:
        # Check if 'updated_at' exists in your model definition before uncommenting it
        new_resolution = models.HTWPressureGaugeResolution(
            pressure=resolution_data.pressure,
            unit=resolution_data.unit,
            valid_upto=resolution_data.valid_upto,
            is_active=resolution_data.is_active,
            created_at=datetime.now(),
            # updated_at=datetime.now() # Uncomment only if column exists in DB model
        )

        db.add(new_resolution)
        db.commit()
        db.refresh(new_resolution)
        
        return new_resolution

    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error creating resolution: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# =====================================================================
# PUT: Update Pressure Gauge Resolution
# =====================================================================
@router.put("/{resolution_id}", response_model=HTWPressureGaugeResolutionResponse)
def update_pressure_gauge_resolution(
    resolution_id: int,
    resolution_data: HTWPressureGaugeResolutionCreate,
    db: Session = Depends(get_db)
):
    try:
        resolution = db.query(models.HTWPressureGaugeResolution).filter(
            models.HTWPressureGaugeResolution.id == resolution_id
        ).first()

        if not resolution:
            raise HTTPException(status_code=404, detail="Resolution not found")

        resolution.pressure = resolution_data.pressure
        resolution.unit = resolution_data.unit
        resolution.valid_upto = resolution_data.valid_upto
        resolution.is_active = resolution_data.is_active
        
        # Check if model has updated_at
        if hasattr(resolution, 'updated_at'):
            resolution.updated_at = datetime.now()

        db.commit()
        db.refresh(resolution)
        return resolution

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# =====================================================================
# PATCH: Update Status (Active/Inactive)
# =====================================================================
@router.patch("/{resolution_id}/status", response_model=HTWPressureGaugeResolutionResponse)
def update_resolution_status(
    resolution_id: int,
    is_active: bool = Query(..., description="New active status"),
    db: Session = Depends(get_db)
):
    try:
        resolution = db.query(models.HTWPressureGaugeResolution).filter(
            models.HTWPressureGaugeResolution.id == resolution_id
        ).first()

        if not resolution:
            raise HTTPException(status_code=404, detail="Resolution not found")

        resolution.is_active = is_active
        
        if hasattr(resolution, 'updated_at'):
            resolution.updated_at = datetime.now()

        db.commit()
        db.refresh(resolution)
        return resolution

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# =====================================================================
# DELETE: Delete Pressure Gauge Resolution
# =====================================================================
@router.delete("/{resolution_id}", status_code=204)
def delete_pressure_gauge_resolution(
    resolution_id: int,
    db: Session = Depends(get_db)
):
    try:
        resolution = db.query(models.HTWPressureGaugeResolution).filter(
            models.HTWPressureGaugeResolution.id == resolution_id
        ).first()

        if not resolution:
            raise HTTPException(status_code=404, detail="Resolution not found")

        db.delete(resolution)
        db.commit()
        return None

    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")