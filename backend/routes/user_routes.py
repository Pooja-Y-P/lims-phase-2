from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from typing import List
from datetime import datetime, timedelta, timezone

from backend.schemas.user_schemas import (
    UserResponse,
    CurrentUserResponse,
    UserListResponse,
    Token # Assuming Token schema is also in user_schemas
)
from backend.services.user_services import (
    authenticate_user,
    get_all_users,
    get_user_by_id
)
from backend.services.email_services import send_welcome_email
from backend.db import get_db
from backend.core import security
from backend.auth import get_current_user

router = APIRouter(
    prefix="/users",
    tags=["Authentication & Users"]
)

@router.post("/login", response_model=UserResponse, status_code=status.HTTP_200_OK)
def login(
    background_tasks: BackgroundTasks,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """
    Authenticates a user, returns a JWT token, and sends a welcome email on first login.
    """
    user = authenticate_user(db, form_data.username, form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if this is the user's first login
    is_first_login = (
        user.created_at and 
        user.created_at > datetime.now(timezone.utc) - timedelta(days=1) and
        user.updated_at is None
    )

    # --- THIS IS THE CRUCIAL FIX ---
    # The data payload for the token now includes the customer_id
    access_token_data = {
        "user_id": user.user_id,
        "sub": str(user.user_id), # 'sub' (subject) is often the user_id or username
        "email": user.email,
        "role": user.role,
        "customer_id": user.customer_id # ADDED
    }

    access_token = security.create_access_token(data=access_token_data)

    # The response body for the user object
    user_response = UserResponse.from_orm(user)
    user_response.token = access_token

    if is_first_login:
        background_tasks.add_task(
            send_welcome_email,
            email=user.email,
            name=user.full_name or user.username,
            role=user.role
        )
        
        user.updated_at = datetime.now(timezone.utc)
        db.commit()

    return user_response


@router.get("/me", response_model=CurrentUserResponse)
def read_current_user(current_user: UserResponse = Depends(get_current_user)):
    """Returns currently authenticated user details."""
    # We set token to None in the response so it's not sent back again.
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