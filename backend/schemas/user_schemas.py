# backend/schemas/user_schemas.py

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime

# ====================================================================
# BASE SCHEMAS FOR JWT & INTERNAL DEPENDENCIES
# ====================================================================

class TokenData(BaseModel):
    user_id: Optional[int] = None
    sub: Optional[EmailStr] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None  # seconds until expiry

class User(BaseModel):
    user_id: int
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

# ====================================================================
# REQUEST SCHEMAS
# ====================================================================

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

# -------------------- InvitationRequest --------------------
class InvitationRequest(BaseModel):
    email: EmailStr
    role: str
    invited_name: str
    customer_id: Optional[int] = None  # Optional: link to a customer

# ====================================================================
# RESPONSE SCHEMAS
# ====================================================================

class UserResponse(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    customer_id: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CurrentUserResponse(UserResponse):
    pass

class UserListResponse(BaseModel):
    users: List[UserResponse]
