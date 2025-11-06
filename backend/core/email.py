"""
Email sending utilities for the LIMS application.

This module handles the configuration of the email service and provides
functions to send various types of transactional emails.
"""

from fastapi import BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import Dict, Any, Optional
from pathlib import Path
from urllib.parse import urlencode
from enum import Enum
from datetime import datetime, timezone
from sqlalchemy.orm import Session

# Import centralized settings
from backend.core.config import settings

# --- 1. Enumeration for User Roles ---
class UserRole(str, Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    CUSTOMER = "customer"

# --- 2. Mail Connection Configuration ---
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_SERVER,
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    TEMPLATE_FOLDER=Path(__file__).parent.parent / 'templates' / 'email'
)

def log_notification_to_db(
    db: Session,
    recipient_email: str,
    subject: str,
    body_text: str,
    status: str = "pending",
    error: str = None,
    recipient_user_id: int = None,
    inward_id: int = None,
    created_by: str = "system"
):
    """Log notification attempt to database"""
    try:
        from backend.models.notifications import Notification
        
        notification = Notification(
            recipient_user_id=recipient_user_id,
            to_email=recipient_email,
            inward_id=inward_id,
            subject=subject,
            body_text=body_text,
            status=status,
            error=error,
            created_by=created_by,
            email_sent_at=datetime.now(timezone.utc) if status == "success" else None
        )
        
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification.id
    except Exception as e:
        print(f"ERROR: Failed to log notification to database: {e}")
        return None

# --- 3. Enhanced Generic Email Sending Function ---
async def send_email_with_logging(
    background_tasks: BackgroundTasks,
    subject: str,
    recipient: EmailStr,
    template_name: str,
    template_body: Dict[str, Any],
    db: Session = None,
    recipient_user_id: int = None,
    inward_id: int = None,
    created_by: str = "system"
):
    """Send email with comprehensive logging to notifications table."""
    notification_id = None
    
    if db:
        body_text = f"Template: {template_name}, Data: {str(template_body)}"
        notification_id = log_notification_to_db(
            db=db,
            recipient_email=recipient,
            subject=subject,
            body_text=body_text,
            status="pending",
            recipient_user_id=recipient_user_id,
            inward_id=inward_id,
            created_by=created_by
        )

    template_path = conf.TEMPLATE_FOLDER / template_name
    if not template_path.exists():
        error_msg = f"Template '{template_name}' not found in {conf.TEMPLATE_FOLDER}"
        print(f"ERROR: {error_msg}")
        if db and notification_id:
            update_notification_status(db, notification_id, "failed", error_msg)
        return False

    try:
        message = MessageSchema(
            subject=subject,
            recipients=[recipient],
            template_body=template_body,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        
        background_tasks.add_task(
            send_email_task, 
            fm, 
            message, 
            template_name, 
            db, 
            notification_id, 
            recipient
        )
        
        print(f"Email task queued: '{subject}' to {recipient} using '{template_name}'")
        return True
        
    except Exception as e:
        error_msg = f"Failed to queue email to {recipient}. Error: {e}"
        print(f"ERROR: {error_msg}")
        if db and notification_id:
            update_notification_status(db, notification_id, "failed", error_msg)
        return False

async def send_email_task(fm: FastMail, message: MessageSchema, template_name: str, db: Session, notification_id: int, recipient: str):
    """Background task to actually send email and update status"""
    try:
        await fm.send_message(message, template_name=template_name)
        print(f"SUCCESS: Email sent to {recipient}")
        if db and notification_id:
            update_notification_status(db, notification_id, "success")
            
    except Exception as e:
        error_msg = f"Failed to send email to {recipient}: {str(e)}"
        print(f"ERROR: {error_msg}")
        if db and notification_id:
            update_notification_status(db, notification_id, "failed", error_msg)

def update_notification_status(db: Session, notification_id: int, status: str, error: str = None):
    """Update notification status in database"""
    try:
        from backend.models.notifications import Notification
        
        notification = db.get(Notification, notification_id)
        if notification:
            notification.status = status
            notification.error = error
            if status == "success":
                notification.email_sent_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        print(f"ERROR: Failed to update notification status: {e}")

# --- 4. Application-Specific Email Functions ---

async def send_new_user_invitation_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    token: str,
    srf_no: str,
    temp_password: str,
    frontend_url: str = settings.FRONTEND_URL,
    db: Session = None,
    inward_id: int = None,
    created_by: str = "system"
):
    """Sends an invitation email to a new customer with the correct FIR link."""
    subject = f"Welcome to LIMS & Action Required for SRF No: {srf_no}"
    activation_link = f"{frontend_url}/activate-account?token={token}"
    
    # === THE FIX IS HERE ===
    # Corrected the path from /report/inward/ to /customer/fir-remarks/
    direct_fir_link = f"{frontend_url}/customer/fir-remarks/{inward_id}" if inward_id else activation_link
    # =======================

    template_body = {
        "title": "Welcome! Please Activate Your Account",
        "srf_no": srf_no,
        "email": recipient_email,
        "temporary_password": temp_password,
        "activation_link": activation_link,
        # This variable name 'direct_link' must match your HTML template's placeholder {{ direct_link }}
        "direct_link": direct_fir_link,
        "valid_for_hours": 48
    }

    return await send_email_with_logging(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        template_name="new_customer_invitation.html",
        template_body=template_body,
        db=db,
        inward_id=inward_id,
        created_by=created_by
    )

async def send_existing_user_notification_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    inward_id: int,
    srf_no: str,
    frontend_url: str = settings.FRONTEND_URL,
    db: Session = None,
    created_by: str = "system"
):
    """Sends a notification email to an existing customer with the correct FIR link."""
    subject = f"Action Required: First Inspection Report Ready for SRF No: {srf_no}"
    
    # === THE FIX IS HERE ===
    # Corrected the path from /report/inward/ to /customer/fir-remarks/
    direct_fir_link = f"{frontend_url}/customer/fir-remarks/{inward_id}"
    # =======================
    
    # This can be a fallback link to the general customer portal login
    login_link = f"{frontend_url}/login"

    template_body = {
        "title": "New Inspection Report Available",
        "srf_no": srf_no,
        # This variable name 'direct_link' must match your HTML template's placeholder {{ direct_link }}
        "direct_link": direct_fir_link,
        "login_link": login_link,
    }

    return await send_email_with_logging(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        # This template name should match the one you sent earlier for the FIR
        template_name="inward_notification.html", 
        template_body=template_body,
        db=db,
        inward_id=inward_id,
        created_by=created_by
    )

# --- Other Email Functions ---

async def send_welcome_email(
    background_tasks: BackgroundTasks,
    email: EmailStr,
    name: str,
    role: UserRole,
    frontend_url: str = settings.FRONTEND_URL,
    db: Session = None,
    inward_id: int = None,
    created_by: str = "system"
):
    """Sends a welcome email to a user after their first successful login."""
    role_config = {
        UserRole.ADMIN: {"template": "welcome_admin.html", "subject": "🎉 Welcome to the LIMS Admin Dashboard", "portal_path": "/admin/dashboard"},
        UserRole.ENGINEER: {"template": "welcome_engineer.html", "subject": "🔬 Welcome to the LIMS Engineer Portal", "portal_path": "/engineer/dashboard"},
        UserRole.CUSTOMER: {"template": "welcome_customer.html", "subject": "🤝 Welcome to Your LIMS Customer Portal", "portal_path": "/portal/dashboard"}
    }

    config = role_config.get(role)
    if not config:
        print(f"ERROR: No welcome email configuration for role: {role}")
        return False

    portal_url = f"{frontend_url}{config['portal_path']}"
    template_body = {"name": name, "portal_url": portal_url}

    return await send_email_with_logging(
        background_tasks=background_tasks,
        subject=config['subject'],
        recipient=email,
        template_name=config['template'],
        template_body=template_body,
        db=db,
        inward_id=inward_id,
        created_by=created_by
    )

def get_password_reset_template(user_name: Optional[str], reset_link: str) -> Dict[str, Any]:
    """Generates subject and body for password reset email."""
    return {
        "subject": "Reset Your LIMS Account Password",
        "template_name": "password_reset.html",
        "template_body": {
            "title": "Password Reset Request",
            "user_name": user_name or "there",
            "message": "We received a request to reset your password. Please click the button below to set a new one.",
            "reset_link": reset_link,
            "valid_for_hours": 1
        }
    }

def get_reminder_email_template(data: Dict[str, Any]) -> Dict[str, Any]:
    """Generates content for reminder emails to engineers."""
    pending_count = data.get("pending_count", 0)
    return {
        "subject": f"URGENT: You have {pending_count} Unsent First Inspection Reports",
        "template_name": "reminder_notification.html",
        "template_body": {
            "title": "Action Required: Unsent Reports",
            "engineer_name": data.get("engineer_name", "Engineer"),
            "pending_count": pending_count,
            "portal_link": data.get("portal_link", "#"),
            "message": "This is a critical alert regarding overdue tasks that require your immediate action."
        }
    }