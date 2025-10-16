# backend/routers/user_router.py

print("\n\n✅✅✅ SERVER IS RUNNING THE CORRECT, UPDATED user_router.py ✅✅✅\n")

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm 
from typing import Optional, List 
from backend.schemas.user_schemas import (
    UserResponse, 
    CurrentUserResponse, 
    UserListResponse
)
from backend.services.user_services import (
    authenticate_user, 
    get_all_users, 
    get_user_by_id
)
from backend.db import get_db 
from backend.core import security 

router = APIRouter(
    prefix="/users",
    tags=["Authentication & Users"]
)

# --- Dependency to decode JWT and retrieve user ---
def get_current_user_from_token(
    db: Session = Depends(get_db),
    authorization: str = Header(..., alias="Authorization", description="Bearer token")
) -> UserResponse: # The dependency now returns the correct Pydantic model
    """Decodes the real JWT token and retrieves the current active user."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = authorization.replace("Bearer ", "")
    
    try:
        payload = security.decode_access_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            raise security.InvalidTokenError("Token is missing user_id claim.")
    except security.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    user = get_user_by_id(db, user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed or user inactive.",
            headers={"WWW-Authenticate": "Bearer"}
        )
        
    # --- START: FIX for TypeError ---
    # The error would have happened here as well. This fix prevents it.
    # 1. Create the Pydantic model from the database object.
    user_response = UserResponse.from_orm(user)
    # 2. Set the token attribute on the created object.
    user_response.token = token
    
    return user_response
    # --- END: FIX for TypeError ---


# 1. Public Route: Login
@router.post("/login", response_model=UserResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Authenticates a user and returns user details with a REAL JWT token."""
    
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    print(f"\n🚀🚀🚀 LOGIN SUCCESS! Generating REAL JWT for user: {user.email} 🚀🚀🚀\n")
    access_token = security.create_access_token(
        data={"user_id": user.user_id, "sub": str(user.user_id), "email": user.email, "role": user.role}
    )
    
    # --- START: FIX for TypeError (cleaner version) ---
    # 1. Create the Pydantic model from the database object.
    user_response = UserResponse.from_orm(user)
    # 2. Set the token attribute on the created object.
    user_response.token = access_token
    
    return user_response
    # --- END: FIX for TypeError ---

# 2. Authenticated Route: Get Current User
@router.get("/me", response_model=CurrentUserResponse)
def get_current_user(
    current_user: UserResponse = Depends(get_current_user_from_token) # Note: Type hint added for clarity
):
    """Retrieves the details of the currently authenticated user."""
    return current_user 

# 3. Authenticated Route (Admin only): Get All Users
@router.get("", response_model=UserListResponse)
def list_all_users(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user_from_token)
):
    """Retrieves a list of all users. Requires administrator role."""

    if current_user.role.lower() != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Must be an administrator."
        )

    users = get_all_users(db)
    # The original code would fail here because `users` is a list of ORM objects,
    # not Pydantic models. This is the correct way to return it.
    user_responses = [CurrentUserResponse.from_orm(u) for u in users]
    return {"users": user_responses}

# 4. Public/Auth Route: Logout
@router.post("/logout")
def logout():
    """Simulates a secure logout."""
    return JSONResponse(
        content={"message": "Logout successful. Client should discard token."},
        status_code=status.HTTP_200_OK
    )