# backend/routes/user_routes.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm 
from typing import List 

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
from backend.auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["Authentication & Users"]
)


@router.post("/login", response_model=UserResponse, status_code=status.HTTP_200_OK)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticates a user and returns a JWT token."""
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create JWT access token
    access_token = security.create_access_token(
        data={
            "user_id": user.user_id,
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
        }
    )

    # Create the Pydantic model from the database object
    user_response = UserResponse.from_orm(user)
    user_response.token = access_token
    
    return user_response


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: UserResponse = Depends(get_current_user)):
    """Returns currently authenticated user details."""
    # Don't expose token in this response
    current_user.token = None
    return current_user


@router.get("", response_model=UserListResponse)
def get_all_users_list(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Returns a list of all users. Requires Admin privileges."""
    if current_user.role.lower() != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Must be an administrator."
        )

    users = get_all_users(db)
    user_responses = [UserResponse.from_orm(u) for u in users]
    return UserListResponse(users=user_responses)


@router.post("/logout")
def logout():
    """Simulates logout. The client application is responsible for discarding the token."""
    return JSONResponse(
        content={"message": "Logout successful. Client should discard token."},
        status_code=status.HTTP_200_OK,
    )