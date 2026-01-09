from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from fastapi import HTTPException
from typing import Optional
import re

from backend.models.htw_job import HTWJob
from backend.schemas.htw_job import HTWJobCreate

def parse_range_string(range_str: str):
    if not range_str:
        return None, None
    clean_str = re.sub(r'[a-zA-Z%]+', '', range_str)
    numbers = [float(n) for n in re.findall(r"[-+]?\d*\.\d+|\d+", clean_str)]
    
    if len(numbers) >= 2:
        return min(numbers), max(numbers)
    elif len(numbers) == 1:
        return 0.0, numbers[0]
    return None, None

def get_jobs(
    db: Session, 
    inward_eqp_id: Optional[int] = None, 
    skip: int = 0, 
    limit: int = 100
):
    """
    Fetches HTW Jobs. 
    If inward_eqp_id is provided, filters by that ID.
    """
    query = db.query(HTWJob)
    
    if inward_eqp_id is not None:
        query = query.filter(HTWJob.inward_eqp_id == inward_eqp_id)
        
    return query.offset(skip).limit(limit).all()

def get_job_by_id(db: Session, job_id: int):
    # FIX: Changed .id to .job_id to match your Model
    return db.query(HTWJob).filter(HTWJob.job_id == job_id).first()

def get_srf_ids(db: Session, inward_eqp_id: int):
    """
    Fetches srf_id and srf_eqp_id by joining inward_equipments and srf_equipments.
    Uses a nested transaction to safely handle SQL errors without aborting the main session.
    """
    try:
        # FIX: Added nested transaction safety
        with db.begin_nested():
            query = text("""
                SELECT se.srf_id, se.srf_eqp_id 
                FROM inward_equipments ie
                JOIN srf_equipments se ON ie.srf_eqp_id = se.srf_eqp_id
                WHERE ie.inward_eqp_id = :id
            """)
            
            result = db.execute(query, {"id": inward_eqp_id}).fetchone()
            
            if result:
                # print(f"DEBUG: Found SRF IDs in DB -> srf_id: {result.srf_id}, srf_eqp_id: {result.srf_eqp_id}")
                return result.srf_id, result.srf_eqp_id
            else:
                # print(f"DEBUG: No SRF link found for inward_eqp_id: {inward_eqp_id}")
                return None, None

    except Exception as e:
        print(f"DEBUG: SQL Lookup Failed. Check Table Names! Error: {e}")
        # No need to manual rollback here, begin_nested handles it
        return None, None

def create_job(db: Session, job_data: HTWJobCreate):
    # 1. Parse Range
    r_min, r_max = parse_range_string(job_data.range_value)
    
    # 2. Parse Resolution
    res_val = None
    if job_data.resolution_pressure_gauge:
        try:
            clean_res = re.sub(r'[a-zA-Z%]+', '', job_data.resolution_pressure_gauge)
            res_val = float(clean_res)
        except ValueError:
            res_val = None

    # 3. === FETCH SRF IDs FROM DATABASE ===
    db_srf_id, db_srf_eqp_id = get_srf_ids(db, job_data.inward_eqp_id)
    
    # Fallback to frontend data if DB lookup failed
    final_srf_id = db_srf_id if db_srf_id else job_data.srf_id
    final_srf_eqp_id = db_srf_eqp_id if db_srf_eqp_id else job_data.srf_eqp_id

    # 4. Create or Update Job
    try:
        existing_job = db.query(HTWJob).filter(HTWJob.inward_eqp_id == job_data.inward_eqp_id).first()
        
        if existing_job:
            existing_job.srf_id = final_srf_id
            existing_job.srf_eqp_id = final_srf_eqp_id
            existing_job.range_min = r_min
            existing_job.range_max = r_max
            existing_job.res_pressure = res_val
            existing_job.date = job_data.calibration_date
            existing_job.type = job_data.device_type
            existing_job.classification = job_data.classification
            
            db.commit()
            db.refresh(existing_job)
            return existing_job
        else:
            db_job = HTWJob(
                inward_id=job_data.inward_id,
                inward_eqp_id=job_data.inward_eqp_id,
                srf_id=final_srf_id,
                srf_eqp_id=final_srf_eqp_id,
                date=job_data.calibration_date,
                range_min=r_min,
                range_max=r_max,
                res_pressure=res_val,
                type=job_data.device_type,
                classification=job_data.classification,
                job_status="Created"
            )
            
            db.add(db_job)
            db.commit()
            db.refresh(db_job)
            return db_job

    except Exception as e:
        db.rollback()
        print(f"CRITICAL DB ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Database Error: {str(e)}")