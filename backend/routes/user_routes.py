from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.core import security
from backend.core.security import LOCAL_TIMEZONE
from ..db import get_db
from backend.schemas.user_schemas import (
    CurrentUserResponse,
    LoginResponse,
    LogoutRequest,
    RefreshTokenRequest,
    TokenRefreshResponse,
    UserListResponse,
    UserResponse,
    UserStatusUpdateRequest,
)
from backend.services import token_service
from backend.services.email_services import send_welcome_email
from backend.services.user_services import (
    authenticate_user,
    get_all_users,
    get_user_by_id,
    set_user_active_status,
)

router = APIRouter(
    prefix="/users",
    tags=["Authentication & Users"]
)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
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
    now_local = datetime.now(LOCAL_TIMEZONE)
    user_created_at = user.created_at
    if user_created_at is not None:
        if user_created_at.tzinfo is None:
            user_created_at = user_created_at.replace(tzinfo=LOCAL_TIMEZONE)
        else:
            user_created_at = user_created_at.astimezone(LOCAL_TIMEZONE)
    is_first_login = (
        user_created_at and 
        user_created_at > now_local - timedelta(days=1) and
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

    refresh_token_payload = {
        "user_id": user.user_id,
        "sub": str(user.user_id),
        "email": user.email,
        "type": "refresh",
    }
    refresh_token = security.create_refresh_token(refresh_token_payload)

    token_service.create_refresh_token_record(
        db,
        user_id=user.user_id,
        token=refresh_token,
    )

    if is_first_login:
        background_tasks.add_task(
            send_welcome_email,
            email=user.email,
            name=user.full_name or user.username,
            role=user.role
        )
        
        user.updated_at = datetime.now(LOCAL_TIMEZONE)
        db.commit()

    return LoginResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        customer_id=user.customer_id,
        is_active=user.is_active,
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


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


@router.patch("/{user_id}/status", response_model=UserResponse)
def update_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Allow administrators to activate or deactivate user accounts."""
    if current_user.role.lower() != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Must be an administrator."
        )

    if current_user.user_id == user_id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account."
        )

    updated_user = set_user_active_status(db, user_id=user_id, is_active=payload.is_active)
    return UserResponse.from_orm(updated_user)


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
):
    """Revoke the provided refresh token."""
    token_record = token_service.get_refresh_token_by_token(db, payload.refresh_token)

    if token_record:
        token_service.revoke_refresh_token(db, token_record=token_record)

    return JSONResponse(
        content={"message": "Logout successful. Client should discard token."},
        status_code=status.HTTP_200_OK,
    )


@router.post("/refresh", response_model=TokenRefreshResponse)
def refresh_access_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    """Exchange a valid refresh token for a new access/refresh token pair."""
    token_record = token_service.get_refresh_token_by_token(db, payload.refresh_token)

    if not token_record or token_record.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    current_utc = datetime.utcnow()

    if token_record.expiry_time < current_utc:
        token_service.revoke_refresh_token(db, token_record=token_record)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload_data = security.decode_refresh_token(payload.refresh_token)
    except security.InvalidTokenError:
        token_service.revoke_refresh_token(db, token_record=token_record)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload_data.get("user_id") or payload_data.get("sub")

    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        token_service.revoke_refresh_token(db, token_record=token_record)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        token_service.revoke_refresh_token(db, token_record=token_record)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_data = {
        "user_id": user.user_id,
        "sub": str(user.user_id),
        "email": user.email,
        "role": user.role,
        "customer_id": user.customer_id,
    }
    access_token = security.create_access_token(access_token_data)

    new_refresh_payload = {
        "user_id": user.user_id,
        "sub": str(user.user_id),
        "email": user.email,
        "type": "refresh",
    }
    new_refresh_token = security.create_refresh_token(new_refresh_payload)
    token_service.revoke_refresh_token(db, token_record=token_record, commit=False)
    new_token_record = token_service.create_refresh_token_record(
        db,
        user_id=user.user_id,
        token=new_refresh_token,
        commit=False,
    )
    db.commit()
    db.refresh(new_token_record)

    return TokenRefreshResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        expires_in=security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )