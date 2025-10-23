# backend/routes/password_reset_router.py

from fastapi import APIRouter, Depends, HTTPException, status, Body, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from backend.db import get_db
from backend.services.password_reset_service import PasswordResetService

router = APIRouter(prefix="/auth", tags=["Password Reset"])

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    request: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Initiate password reset process"""
    password_service = PasswordResetService(db)
    
    await password_service.initiate_password_reset(
        email=request.email,
        background_tasks=background_tasks
    )
    
    return {
        "message": "If an account with this email exists, you will receive password reset instructions."
    }

@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(
    request: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    """Reset password using token"""
    password_service = PasswordResetService(db)
    
    success = password_service.reset_password(
        token=request.token,
        new_password=request.new_password
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    return {"message": "Password reset successfully"}

@router.get("/verify-reset-token/{token}", status_code=status.HTTP_200_OK)
def verify_reset_token(
    token: str,
    db: Session = Depends(get_db)
):
    """Verify if reset token is valid"""
    password_service = PasswordResetService(db)
    user = password_service.verify_reset_token(token)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    return {
        "valid": True,
        "email": user.email
    }