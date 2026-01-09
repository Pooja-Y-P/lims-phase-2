# backend/routes/htw_nomenclature_range_router.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import datetime
import logging

from ..schemas.htw_nomenclature_range_schemas import (
    HTWNomenclatureRangeCreate,
    HTWNomenclatureRangeUpdate,
    HTWNomenclatureRangeResponse,
    RangeMatchRequest,
    RangeMatchResponse
)
from .. import models
from ..db import get_db
from ..auth import get_current_user
from ..schemas.user_schemas import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/htw-nomenclature-ranges",
    tags=["HTW Nomenclature Ranges"]
)


# =====================================================================
# GET: All HTW Nomenclature Ranges (List View)
# =====================================================================
@router.get("/", response_model=List[HTWNomenclatureRangeResponse])
def get_htw_nomenclature_ranges(
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = Query(None)
):
    """
    Retrieves a list of HTW Nomenclature Ranges.
    """
    try:
        query = db.query(models.HTWNomenclatureRange)
        
        # Filter by active status if provided
        if is_active is not None:
            query = query.filter(models.HTWNomenclatureRange.is_active == is_active)
        
        # Order by range_min ascending
        query = query.order_by(models.HTWNomenclatureRange.range_min.asc())
        
        # Apply pagination
        ranges = query.offset(skip).limit(limit).all()
        
        return ranges
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# GET: Single HTW Nomenclature Range (Detail View)
# =====================================================================
@router.get("/{range_id}", response_model=HTWNomenclatureRangeResponse)
def get_htw_nomenclature_range(
    range_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieves a single HTW Nomenclature Range by ID.
    """
    range_obj = db.query(models.HTWNomenclatureRange).filter(
        models.HTWNomenclatureRange.id == range_id
    ).first()
    
    if not range_obj:
        raise HTTPException(
            status_code=404,
            detail=f"HTW Nomenclature Range with ID {range_id} not found"
        )
    
    return range_obj


# =====================================================================
# POST: Create HTW Nomenclature Range
# =====================================================================
@router.post("/", response_model=HTWNomenclatureRangeResponse, status_code=201)
def create_htw_nomenclature_range(
    range_data: HTWNomenclatureRangeCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Creates a new HTW Nomenclature Range.
    """
    try:
        # Validate range_min < range_max
        if range_data.range_min >= range_data.range_max:
            raise HTTPException(
                status_code=400,
                detail="range_min must be less than range_max"
            )
        
        # Create new range instance
        new_range = models.HTWNomenclatureRange(**range_data.model_dump())
        
        db.add(new_range)
        db.commit()
        db.refresh(new_range)
        
        return new_range
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# PUT: Update HTW Nomenclature Range
# =====================================================================
@router.put("/{range_id}", response_model=HTWNomenclatureRangeResponse)
def update_htw_nomenclature_range(
    range_id: int,
    range_data: HTWNomenclatureRangeUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Updates an existing HTW Nomenclature Range.
    """
    try:
        # Find the range
        range_obj = db.query(models.HTWNomenclatureRange).filter(
            models.HTWNomenclatureRange.id == range_id
        ).first()
        
        if not range_obj:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Nomenclature Range with ID {range_id} not found"
            )
        
        # Update fields
        update_data = range_data.model_dump(exclude_unset=True)
        
        # Validate range_min < range_max if both are being updated
        range_min = update_data.get('range_min', range_obj.range_min)
        range_max = update_data.get('range_max', range_obj.range_max)
        
        if range_min is not None and range_max is not None:
            if range_min >= range_max:
                raise HTTPException(
                    status_code=400,
                    detail="range_min must be less than range_max"
                )
        
        for field, value in update_data.items():
            setattr(range_obj, field, value)
        
        # Update the updated_at timestamp
        range_obj.updated_at = datetime.now()
        
        db.commit()
        db.refresh(range_obj)
        
        return range_obj
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# PATCH: Update HTW Nomenclature Range Status
# =====================================================================
@router.patch("/{range_id}/status", response_model=HTWNomenclatureRangeResponse)
def update_htw_nomenclature_range_status(
    range_id: int,
    is_active: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Updates the active status of an HTW Nomenclature Range.
    """
    try:
        range_obj = db.query(models.HTWNomenclatureRange).filter(
            models.HTWNomenclatureRange.id == range_id
        ).first()
        
        if not range_obj:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Nomenclature Range with ID {range_id} not found"
            )
        
        range_obj.is_active = is_active
        range_obj.updated_at = datetime.now()
        
        db.commit()
        db.refresh(range_obj)
        
        return range_obj
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")


# =====================================================================
# DELETE: Delete HTW Nomenclature Range
# =====================================================================
@router.delete("/{range_id}", status_code=204)
def delete_htw_nomenclature_range(
    range_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Deletes an HTW Nomenclature Range.
    """
    try:
        range_obj = db.query(models.HTWNomenclatureRange).filter(
            models.HTWNomenclatureRange.id == range_id
        ).first()
        
        if not range_obj:
            raise HTTPException(
                status_code=404,
                detail=f"HTW Nomenclature Range with ID {range_id} not found"
            )
        
        db.delete(range_obj)
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


# =====================================================================
# POST: Match Range Values to Nomenclatures
# =====================================================================
@router.post("/match", response_model=RangeMatchResponse)
def match_range_to_nomenclatures(
    match_request: RangeMatchRequest,
    db: Session = Depends(get_db)
):
    """
    Matches device range (min_value to max_value) against nomenclature ranges.
    Returns all nomenclatures whose ranges overlap with the device range.
    Two ranges overlap if: device_min <= nomenclature_max AND device_max >= nomenclature_min
    """
    try:
        # Get all active nomenclature ranges
        ranges = db.query(models.HTWNomenclatureRange).filter(
            models.HTWNomenclatureRange.is_active == True
        ).all()
        
        min_matched = None
        max_matched = None
        matched_nomenclatures = set()
        
        # Check which nomenclature ranges overlap with the device range
        # Two ranges overlap if: device_min <= nomenclature_max AND device_max >= nomenclature_min
        for range_obj in ranges:
            range_min = float(range_obj.range_min)
            range_max = float(range_obj.range_max)
            device_min = match_request.min_value
            device_max = match_request.max_value
            
            # Check if ranges overlap
            ranges_overlap = device_min <= range_max and device_max >= range_min
            
            if ranges_overlap:
                matched_nomenclatures.add(range_obj.nomenclature)
                
                # Track which nomenclature matches min_value (for reference)
                if range_min <= device_min <= range_max:
                    min_matched = range_obj.nomenclature
                
                # Track which nomenclature matches max_value (for reference)
                if range_min <= device_max <= range_max:
                    max_matched = range_obj.nomenclature
        
        return RangeMatchResponse(
            matched_nomenclatures=list(matched_nomenclatures),
            min_matched=min_matched,
            max_matched=max_matched
        )
    except Exception as e:
        logger.error(f"Error matching range: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")

