# backend/api/auth.py

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse

from backend.db import get_db
from backend.services import user_services
from backend.schemas.user_schemas import (
    UserResponse,
    CurrentUserResponse,
    UserListResponse,
)
from backend.core import security

router = APIRouter(prefix="/users", tags=["Authentication & Users"])


# ============================================================
# 🔒 Dependency: Get Current User from JWT Token
# ============================================================
def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
) -> UserResponse:
    """
    Decodes JWT token from the Authorization header and fetches the current user.
    Expects header: Authorization: Bearer <token>
    """

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ")[1]

    try:
        payload = security.decode_access_token(token)
        user_id = payload.get("user_id")
        if user_id is None:
            raise security.InvalidTokenError("Missing user_id claim in token.")
    except security.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user_id in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = user_services.get_user_by_id(db, user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # --- START: FIX for TypeError ---
    # 1. Create the Pydantic model from the database object first.
    user_response = UserResponse.from_orm(user)
    # 2. Now, set the token attribute on the created object.
    user_response.token = token
    
    # 3. Return the final, complete object.
    return user_response
    # --- END: FIX for TypeError ---


# ============================================================
# 🧑‍💼 Dependency: Require Admin
# ============================================================
def require_admin(current_user: UserResponse = Depends(get_current_user)):
    """Ensures the user has the 'admin' role."""
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Admin role required.",
        )
    return current_user


# ============================================================
# 🔐 1. LOGIN
# ============================================================
@router.post("/login", response_model=UserResponse, status_code=status.HTTP_200_OK)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticates a user and returns a JWT token.
    """

    user = user_services.authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    print(f"\n✅✅✅ LOGIN SUCCESSFUL: Generating REAL token for user: {user.email}\n")

    # Create JWT access token
    access_token = security.create_access_token(
        data={
            "user_id": user.user_id,
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
        }
    )

    # --- START: FIX for TypeError (applied here for consistency) ---
    # 1. Create the Pydantic model from the database object.
    user_response = UserResponse.from_orm(user)
    # 2. Set the token attribute on the created object.
    user_response.token = access_token
    
    # 3. Return the final, complete object.
    return user_response
    # --- END: FIX for TypeError ---


# ============================================================
# 🙋 2. GET CURRENT USER (/me)
# ============================================================
@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: UserResponse = Depends(get_current_user)):
    """Returns currently authenticated user details."""
    current_user.token = None  # Do not expose token in this response
    return current_user


# ============================================================
# 👥 3. GET ALL USERS (Admin Only)
# ============================================================
@router.get("", response_model=UserListResponse)
def get_all_users_list(
    db: Session = Depends(get_db),
    admin_user: UserResponse = Depends(require_admin),
):
    """
    Returns a list of all users. Requires Admin privileges.
    """
    users = user_services.get_all_users(db)
    # The error was also present here. Fixing it.
    user_responses = [UserResponse.from_orm(u) for u in users]
    return UserListResponse(users=user_responses)


# ============================================================
# 🔓 4. LOGOUT
# ============================================================
@router.post("/logout")
def logout():
    """
    Simulates logout. The client application is responsible for discarding the token.
    """
    return JSONResponse(
        content={"message": "Logout successful. Client should discard token."},
        status_code=status.HTTP_200_OK,
    )