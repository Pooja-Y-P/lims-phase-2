# backend/services/password_reset_service.py

import secrets
# --- FIX 1: Import timezone for aware datetime objects ---
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from fastapi import HTTPException, BackgroundTasks

from backend.models.users import User
from backend.models.password_reset_token import PasswordResetToken
from backend.core.security import hash_password
from backend.core.email import send_email_task, get_password_reset_template

class PasswordResetService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_reset_token(self) -> str:
        """Generate a secure password reset token."""
        return secrets.token_urlsafe(32)
    
    async def initiate_password_reset(self, email: str, background_tasks: BackgroundTasks) -> bool:
        """
        Initiate password reset process. Finds a user by email, invalidates old tokens,
        creates a new one, and sends a reset link via email.
        """
        user = self.db.scalars(select(User).where(User.email == email)).first()
        
        if not user:
            # Don't reveal whether user exists for security reasons.
            # The process will appear to succeed to prevent user enumeration.
            return True
        
        # Invalidate all existing tokens for this user by deleting them.
        self.db.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user.user_id)
        )

        # Create a new reset token
        token = self.generate_reset_token()
        # --- FIX 1: Use timezone-aware datetime for token creation ---
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        new_reset_request = PasswordResetToken(
            user_id=user.user_id,
            token=token,
            expires_at=expires_at
        )
        self.db.add(new_reset_request)
        self.db.commit()

        # Prepare and send the email in the background.
        reset_link = f"http://localhost:5173/reset-password?token={token}"
        template_data = get_password_reset_template(user.full_name, reset_link)

        # Send email using the correct parameters
        await send_email_task(
            background_tasks=background_tasks,
            subject=template_data["subject"],
            recipient=user.email,
            template_name=template_data["template_name"],
            template_body=template_data["template_body"]
        )
        
        return True

    def reset_password(self, token: str, new_password: str) -> bool:
        """
        Resets the user's password if the provided token is valid, unused, and not expired.
        """
        # Find the reset request by the token
        reset_request = self.db.scalars(
            select(PasswordResetToken).where(PasswordResetToken.token == token)
        ).first()

        # Validate the token
        if not reset_request:
            raise HTTPException(status_code=400, detail="Invalid password reset token.")
        
        if reset_request.is_used:
            raise HTTPException(status_code=400, detail="Password reset token has already been used.")

        # --- FIX 1: Use timezone-aware datetime for comparison ---
        if datetime.now(timezone.utc) > reset_request.expires_at:
            raise HTTPException(status_code=400, detail="Password reset token has expired.")

        # Find the associated user
        user = self.db.get(User, reset_request.user_id)
        if not user:
            # This is an edge case but good to handle
            raise HTTPException(status_code=404, detail="User associated with this token not found.")

        # --- FIX 2: Use the correct attribute name 'password_hash' from the User model ---
        user.password_hash = hash_password(new_password)
        reset_request.is_used = True
        
        self.db.add(user)
        self.db.add(reset_request)
        self.db.commit()

        return True
    
    def verify_reset_token(self, token: str) -> Optional[User]:
        """
        Verify if a reset token is valid and return the associated user.
        """
        # Find the reset request by the token
        reset_request = self.db.scalars(
            select(PasswordResetToken).where(PasswordResetToken.token == token)
        ).first()

        # Validate the token
        if not reset_request:
            return None
        
        if reset_request.is_used:
            return None

        # --- FIX 1: Use timezone-aware datetime for comparison ---
        if datetime.now(timezone.utc) > reset_request.expires_at:
            return None

        # Find and return the associated user
        user = self.db.get(User, reset_request.user_id)
        return user