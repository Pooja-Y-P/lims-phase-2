from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.refresh_token import RefreshToken
from backend.core.security import (
    REFRESH_TOKEN_EXPIRE_MINUTES,
    LOCAL_TIMEZONE,
)


def create_refresh_token_record(
    db: Session,
    *,
    user_id: int,
    token: str,
    expires_at: Optional[datetime] = None,
    commit: bool = True,
) -> RefreshToken:
    """
    Persist a newly generated refresh token for the given user.
    """
    issued_at = datetime.now(LOCAL_TIMEZONE)
    if expires_at is None:
        expires_at = issued_at + timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    else:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=LOCAL_TIMEZONE)
        else:
            expires_at = expires_at.astimezone(LOCAL_TIMEZONE)

    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expiry_time=expires_at,
        is_revoked=0,
        created_at=issued_at,
    )
    db.add(refresh_token)
    if commit:
        db.commit()
        db.refresh(refresh_token)
    else:
        db.flush()
    return refresh_token


def get_refresh_token_by_token(
    db: Session,
    token: str,
) -> Optional[RefreshToken]:
    """
    Look up a refresh token record by its token string.
    """
    return (
        db.query(RefreshToken)
        .filter(RefreshToken.token == token)
        .first()
    )


def revoke_refresh_token(
    db: Session,
    *,
    token_record: RefreshToken,
    commit: bool = True,
) -> RefreshToken:
    """
    Mark the provided refresh token record as revoked.
    """
    token_record.is_revoked = 1
    if commit:
        db.commit()
        db.refresh(token_record)
    else:
        db.flush()
    return token_record


def revoke_refresh_tokens_for_user(
    db: Session,
    *,
    user_id: int,
) -> None:
    """
    Revoke all refresh tokens for the specified user.
    """
    (
        db.query(RefreshToken)
        .filter(RefreshToken.user_id == user_id, RefreshToken.is_revoked == 0)
        .update({RefreshToken.is_revoked: 1}, synchronize_session=False)
    )
    db.commit()

