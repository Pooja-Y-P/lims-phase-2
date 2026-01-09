from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.htw_job import HTWJobCreate, HTWJobResponse
from ..services import htw_job as service

router = APIRouter(prefix="/htw-jobs", tags=["HTW Jobs"])

@router.post("/", response_model=HTWJobResponse)
def create_or_update_htw_job(job_data: HTWJobCreate, db: Session = Depends(get_db)):
    """
    Creates a new HTW Job based on technical details.
    If the job already exists for this equipment ID, it updates the details.
    """
    return service.create_job(db, job_data)

@router.get("/", response_model=List[HTWJobResponse])
def read_htw_jobs(
    inward_eqp_id: Optional[int] = Query(None, description="Filter by Inward Equipment ID"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Retrieve HTW Jobs.
    Can filter by 'inward_eqp_id' to check if a job exists for a specific equipment.
    """
    jobs = service.get_jobs(db, inward_eqp_id=inward_eqp_id, skip=skip, limit=limit)
    return jobs

@router.get("/{job_id}", response_model=HTWJobResponse)
def read_htw_job(job_id: int, db: Session = Depends(get_db)):
    """
    Get a specific job by its primary key ID.
    """
    job = service.get_job_by_id(db, job_id=job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job