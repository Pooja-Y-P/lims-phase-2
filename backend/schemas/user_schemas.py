# backend/schemas/user_schemas.py

from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime

# ====================================================================
# BASE SCHEMAS FOR JWT & INTERNAL DEPENDENCIES
# ====================================================================

# 1. Schema for the data stored inside the JWT token (payload)
class TokenData(BaseModel):
    # 'user_id' is the primary identifier used to fetch the user from the DB
    user_id: Optional[int] = None 
    # 'sub' (subject) is often the email, used for JWT standard compliance
    sub: Optional[EmailStr] = None 

# 2. Schema for the standard OAuth2 token response (returned by the /login endpoint)
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    # Optional fields for refresh flow
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None # Time until access token expires (in seconds)


# 3. Simple User Schema for internal dependencies (e.g., used as the UserSchema alias)
# This model primarily holds the data returned by the get_current_user dependency.
class User(BaseModel):
    user_id: int
    email: EmailStr
    role: str
    is_active: bool
    
    # Configuration for ORM/Database compatibility (Pydantic V2 style)
    model_config = ConfigDict(from_attributes=True) 

# ====================================================================
# REQUEST SCHEMAS
# ====================================================================

class UserLoginRequest(BaseModel):
    # This request schema is technically not used by the JWT /login route
    # (which uses OAuth2PasswordRequestForm), but kept for clarity/testing.
    email: EmailStr
    password: str

# ====================================================================
# RESPONSE SCHEMAS
# ====================================================================

# The comprehensive schema for a user record
class UserResponse(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # The current access token is optionally included in the response
    # (e.g., when successfully logging in)
    token: Optional[str] = None 

    # Configuration for ORM/Database compatibility (Pydantic V2 style)
    model_config = ConfigDict(from_attributes=True)

# Schema for the /users/me endpoint (inherits from UserResponse)
class CurrentUserResponse(UserResponse):
    # It typically uses the same structure as UserResponse
    pass

# Schema for fetching a list of all users
class UserListResponse(BaseModel):
    users: List[UserResponse]