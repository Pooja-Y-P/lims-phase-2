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

# --- Token exchange schemas ---
class LoginResponse(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    customer_id: Optional[int] = None
    is_active: bool
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class TokenRefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class LogoutRequest(BaseModel):
    refresh_token: str

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

# --- NEW: Schema for Batch Company Update ---
class BatchCustomerUserStatusRequest(BaseModel):
    customer_details: str
    is_active: bool

# -------------------- InvitationRequest --------------------
class InvitationRequest(BaseModel):
    email: EmailStr
    role: str
    invited_name: Optional[str] = None  # Optional for customer role
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    phone_number: Optional[str] = None
    customer_id: Optional[int] = None 
    ship_to_address: Optional[str] = None
    bill_to_address : Optional[str] = None

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
    
    # This allows the frontend to see the Company Name for grouping
    customer_details: Optional[str] = None 
    
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    token: Optional[str] = None
    refresh_token: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CurrentUserResponse(UserResponse):
    pass

class UserListResponse(BaseModel):
    users: List[UserResponse]