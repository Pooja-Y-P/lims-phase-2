from pydantic import BaseModel
from typing import Optional

class LockRequest(BaseModel):
    entity_type: str
    entity_id: int

class LockResponse(BaseModel):
    status: str  # "acquired", "locked", "released"
    locked_by: Optional[str] = None
    locked_by_id: Optional[int] = None   #
    message: str