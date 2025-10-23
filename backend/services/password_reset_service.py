# backend/services/password_reset_service.py

import secrets
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from fastapi import HTTPException, BackgroundTasks

from backend.models.users import User
from backend.models.password_reset_token import PasswordResetToken
from backend.core.security import hash_password
from backend.core.email import get_password_reset_template, send_email

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
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )

        # Create a new reset token
        token = self.generate_reset_token()
        expires_at = datetime.utcnow() + timedelta(hours=1)  # Token is valid for 1 hour

        new_reset_request = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at
        )
        self.db.add(new_reset_request)
        self.db.commit()

        # Prepare and send the email in the background.
        # NOTE: Replace 'https://your-frontend-app.com' with your actual frontend URL.
        reset_link = f"https://your-frontend-app.com/reset-password?token={token}"
        email_content = get_password_reset_template(user.full_name, reset_link)

        background_tasks.add_task(
            send_email,
            recipient_email=user.email,
            subject="Your Password Reset Request",
            content=email_content
        )
        
        return True

    async def reset_password(self, token: str, new_password: str) -> bool:
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
        
        if reset_request.used:
            raise HTTPException(status_code=400, detail="Password reset token has already been used.")

        if datetime.utcnow() > reset_request.expires_at:
            raise HTTPException(status_code=400, detail="Password reset token has expired.")

        # Find the associated user
        user = self.db.get(User, reset_request.user_id)
        if not user:
            # This is an edge case but good to handle
            raise HTTPException(status_code=404, detail="User associated with this token not found.")

        # Update the user's password and mark the token as used
        user.hashed_password = hash_password(new_password)
        reset_request.used = True
        
        self.db.add(user)
        self.db.add(reset_request)
        self.db.commit()

        return True