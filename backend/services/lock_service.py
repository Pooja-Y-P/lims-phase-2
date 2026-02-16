from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from backend.models.record_lock import RecordLock
from datetime import datetime, timedelta
from fastapi import Request, HTTPException, Depends
from backend.db import get_db
from backend.auth import get_current_user

# This is a FAILSAFE time. 
# If user exits normally, lock is deleted INSTANTLY.
# If user crashes, lock expires after this time.
# Frontend refreshes this every 2 minutes via heartbeat.
LOCK_DURATION_MINUTES = 5 

def acquire_lock(db: Session, entity_type: str, entity_id: int, user_id: int, role: str, customer_id: int = None):
    now = datetime.now()
    
    # 1. GARBAGE COLLECTION: Delete expired locks immediately
    # This ensures if someone crashed 10 mins ago, the lock is freed NOW.
    db.query(RecordLock).filter(
        RecordLock.entity_type == entity_type,
        RecordLock.entity_id == entity_id,
        RecordLock.expires_at < now
    ).delete(synchronize_session=False)
    
    # Commit the delete to free up the Unique Constraint
    try:
        db.commit()
    except Exception:
        db.rollback()

    # 2. Check if a valid lock STILL exists (from an active user)
    active_lock = db.query(RecordLock).filter(
        RecordLock.entity_type == entity_type,
        RecordLock.entity_id == entity_id
    ).first()

    if active_lock:
        # CASE A: I already own it -> Extend Time (Heartbeat)
        if active_lock.locked_by_user_id == user_id:
            active_lock.expires_at = now + timedelta(minutes=LOCK_DURATION_MINUTES)
            # Update metadata in case role/customer changed
            active_lock.locked_by_role = role
            if customer_id:
                active_lock.customer_id = customer_id
            
            db.commit()
            return {"status": "acquired", "message": "Lock refreshed"}
        
        # CASE B: Someone else owns it -> Deny
        return {
            "status": "locked", 
            "locked_by": f"User ID {active_lock.locked_by_user_id} ({active_lock.locked_by_role})",
            "message": "Record is locked by another user"
        }

    # 3. No lock exists -> Create New (INSERT)
    try:
        new_lock = RecordLock(
            entity_type=entity_type,
            entity_id=entity_id,
            locked_by_user_id=user_id,
            locked_by_role=role,
            customer_id=customer_id,
            expires_at=now + timedelta(minutes=LOCK_DURATION_MINUTES),
            is_active=True
        )
        db.add(new_lock)
        db.commit()
        return {"status": "acquired", "message": "Lock acquired"}
        
    except IntegrityError:
        # Race Condition: Someone else inserted milliseconds before us
        db.rollback()
        # Recursively call self to handle the new state (will fall into CASE B above)
        return acquire_lock(db, entity_type, entity_id, user_id, role, customer_id)

def release_lock(db: Session, entity_type: str, entity_id: int, user_id: int):
    # HARD DELETE the lock if I own it
    result = db.query(RecordLock).filter(
        RecordLock.entity_type == entity_type,
        RecordLock.entity_id == entity_id,
        RecordLock.locked_by_user_id == user_id
    ).delete(synchronize_session=False)

    db.commit()
    
    if result > 0:
        return {"status": "released", "message": "Lock deleted"}
    return {"status": "released", "message": "No lock found to delete"}

# --- Lock Guard (For Routes) ---
class LockGuard:
    def __init__(self, entity_type: str, id_param_name: str = "id"):
        self.entity_type = entity_type
        self.id_param_name = id_param_name

    def __call__(self, request: Request, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
        entity_id = request.path_params.get(self.id_param_name)
        if not entity_id: return True 

        user_id = None
        if hasattr(current_user, "id"): user_id = current_user.id
        elif isinstance(current_user, dict): user_id = current_user.get("id") or current_user.get("user_id")
        
        if not user_id: return True 

        # Check DB for active lock
        # We don't check expiration here because the service handles cleanup.
        # If it exists in DB, it is considered active.
        active_lock = db.query(RecordLock).filter(
            RecordLock.entity_type == self.entity_type,
            RecordLock.entity_id == entity_id
        ).first()

        if active_lock and active_lock.locked_by_user_id != user_id:
            # Double check expiry just in case
            if active_lock.expires_at > datetime.now():
                raise HTTPException(
                    status_code=409, 
                    detail=f"Record is locked by User ID {active_lock.locked_by_user_id}"
                )
        
        return True