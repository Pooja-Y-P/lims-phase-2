import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.auth import get_current_user 
from backend.services import lock_service
from pydantic import BaseModel
from typing import Any, Optional

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

class LockRequest(BaseModel):
    entity_type: str
    entity_id: int

class LockResponse(BaseModel):
    status: str
    locked_by: Optional[str] = None
    message: str

# Router Prefix: "/locks" (Assuming main.py adds /api)
router = APIRouter(prefix="/locks", tags=["Concurrency Locks"])

# --- HELPERS ---
def get_user_attr(user: Any, attr: str, default=None):
    """Safely get attribute from dict, Pydantic, or ORM object"""
    if isinstance(user, dict):
        return user.get(attr, default)
    if hasattr(user, attr):
        return getattr(user, attr)
    # Check Pydantic model_dump/dict
    if hasattr(user, "model_dump"):
        return user.model_dump().get(attr, default)
    if hasattr(user, "dict"):
        return user.dict().get(attr, default)
    return default

@router.post("/acquire", response_model=LockResponse)
def acquire(req: LockRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        # Extract User Data Safely
        user_id = get_user_attr(current_user, "user_id") or get_user_attr(current_user, "id")
        role = get_user_attr(current_user, "role", "unknown")
        customer_id = get_user_attr(current_user, "customer_id")

        if not user_id:
            logger.error(f"❌ [ACQUIRE FAILED] Could not extract User ID from: {current_user}")
            raise ValueError("Could not determine User ID")

        logger.info(f"🔒 [ACQUIRE] User:{user_id} Role:{role} -> {req.entity_type} #{req.entity_id}")
        
        # Call Service (Updated to handle Delete/Insert logic)
        result = lock_service.acquire_lock(
            db, 
            req.entity_type, 
            req.entity_id, 
            user_id, 
            role,
            customer_id
        )
        
        if result["status"] == "locked":
            # Return 409 Conflict if locked by someone else
            raise HTTPException(status_code=409, detail=result)
        
        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"❌ [ACQUIRE CRASH] {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Server Error: {str(e)}"
        )

@router.post("/release")
def release(req: LockRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        user_id = get_user_attr(current_user, "user_id") or get_user_attr(current_user, "id")
        
        if not user_id:
             logger.warning(f"⚠️ [RELEASE SKIPPED] No User ID found")
             return {"status": "ignored", "message": "User not identified"}

        logger.info(f"🔓 [RELEASE] User:{user_id} -> {req.entity_type} #{req.entity_id}")
        
        return lock_service.release_lock(db, req.entity_type, req.entity_id, user_id)

    except Exception as e:
        logger.error(f"❌ [RELEASE CRASH] {str(e)}", exc_info=True)
        # We don't want to break the UI on release failure, usually log and ignore
        # But returning 500 helps debug
        raise HTTPException(status_code=500, detail=str(e))