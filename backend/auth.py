# backend/auth.py

from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.services import user_services
from backend.schemas.user_schemas import UserResponse
from backend.core import security


def get_current_user(
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None, alias="Authorization")
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
    
    # Create the Pydantic model from the database object
    user_response = UserResponse.from_orm(user)
    user_response.token = token
    user_response.refresh_token = None

    return user_response