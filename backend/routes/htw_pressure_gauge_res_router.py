# backend/routes/htw_pressure_gauge_res_router.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
import logging

from ..db import get_db
from .. import models
from ..schemas.htw_pressure_gauge_resolution import (
    HTWPressureGaugeResolutionResponse
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
            .filter(models.HTWPressureGaugeResolution.is_active == True)
        )
        
        if unit:
            # Use exact match for unit filtering
            query = query.filter(
                models.HTWPressureGaugeResolution.unit.isnot(None),
                models.HTWPressureGaugeResolution.unit == unit.strip()
            )
        
        resolutions = query.order_by(models.HTWPressureGaugeResolution.pressure.asc()).all()
        
        logger.info(f"Found {len(resolutions)} resolutions for unit: {unit}")
        
        # Convert to response format to ensure proper serialization
        result = []
        for res in resolutions:
            try:
                # Convert Decimal to float for JSON serialization
                pressure_value = float(res.pressure) if res.pressure is not None else None
                result.append(HTWPressureGaugeResolutionResponse(
                    pressure=pressure_value,
                    unit=res.unit,
                    valid_upto=res.valid_upto
                ))
            except Exception as e:
                logger.error(f"Error serializing resolution {res.id}: {str(e)}", exc_info=True)
                raise
        
        return result

    except SQLAlchemyError as e:
        logger.error(f"Database error in get_pressure_gauge_resolutions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Error in get_pressure_gauge_resolutions: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An internal server error occurred: {str(e)}"
        )


# =====================================================================
# GET: Unique Units
# =====================================================================
@router.get("/units", response_model=List[str])
def get_unique_units(
    db: Session = Depends(get_db)
):
    """
    Retrieves all unique units from active HTW Pressure Gauge Resolutions.
    """
    try:
        units = (
            db.query(models.HTWPressureGaugeResolution.unit)
            .filter(models.HTWPressureGaugeResolution.is_active == True)
            .distinct()
            .order_by(models.HTWPressureGaugeResolution.unit.asc())
            .all()
        )

        return [unit[0] for unit in units if unit[0]]

    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An internal server error occurred: {str(e)}"
        )

