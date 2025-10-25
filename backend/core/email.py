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

# --- 3. Generic Email Sending Function ---
async def send_email(
    background_tasks: BackgroundTasks,
    subject: str,
    recipient: EmailStr,
    template_name: str,
    template_body: Dict[str, Any]
):
    """Queues an email sending task in the background."""
    template_path = conf.TEMPLATE_FOLDER / template_name
    if not template_path.exists():
        print(f"ERROR: Template '{template_name}' not found in {conf.TEMPLATE_FOLDER}")
        return

    try:
        message = MessageSchema(
            subject=subject,
            recipients=[recipient],
            template_body=template_body,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        background_tasks.add_task(fm.send_message, message, template_name=template_name)
        print(f"Email task queued: '{subject}' to {recipient} using '{template_name}'")
    except Exception as e:
        print(f"ERROR: Failed to queue email to {recipient}. Error: {e}")

# --- 4. Role-Based Invitation Email ---
async def send_new_user_invitation(
    background_tasks: BackgroundTasks,
    email: EmailStr,
    name: str,
    token: str,
    temporary_password: str,
    role: UserRole,
    expires_hours: int = 48,
    frontend_url: str = "http://localhost:5173"
):
    """Sends an account activation invitation to a new user based on their role."""
    role_templates = {
        UserRole.ADMIN: "invitation_admin.html",
        UserRole.ENGINEER: "invitation_engineer.html",
        UserRole.CUSTOMER: "invitation_customer.html"
    }

    template_name = role_templates.get(role)
    if not template_name:
        print(f"ERROR: No invitation template for role: {role}")
        return

    subject = f"Welcome to LIMS - Activate Your {role.value.capitalize()} Account"
    activation_link = f"{frontend_url}/portal/activate?token={token}"

    template_body = {
        "name": name,
        "email": email,
        "temporary_password": temporary_password,
        "role": role.value.capitalize(),
        "activation_link": activation_link,
        "expires_hours": expires_hours
    }

    await send_email(
        background_tasks=background_tasks,
        subject=subject,
        recipient=email,
        template_name=template_name,
        template_body=template_body
    )

# --- 5. Role-Based Welcome Email ---
async def send_welcome_email(
    background_tasks: BackgroundTasks,
    email: EmailStr,
    name: str,
    role: UserRole,
    frontend_url: str = "http://localhost:5173"
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
        return

    portal_url = f"{frontend_url}{config['portal_path']}"
    template_body = {"name": name, "portal_url": portal_url}

    await send_email(
        background_tasks=background_tasks,
        subject=config['subject'],
        recipient=email,
        template_name=config['template'],
        template_body=template_body
    )

# --- 6. Legacy / Compatibility Email Templates ---

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

async def send_new_user_invitation_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    token: str,
    srf_no: str,
    temp_password: str,
    frontend_url: str = "http://localhost:5173"
):
    """Legacy invitation email for a new customer."""
    subject = f"Your LIMS Account for SRF No: {srf_no} Has Been Created"
    activation_link = f"{frontend_url}/portal/activate?token={token}"

    template_body = {
        "title": "Welcome! Please Activate Your Account",
        "srf_no": srf_no,
        "email": recipient_email,
        "temporary_password": temp_password,
        "activation_link": activation_link,
        "valid_for_hours": 48
    }

    await send_email(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        template_name="new_customer_invitation.html",
        template_body=template_body
    )

async def send_existing_user_notification_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    inward_id: int,
    srf_no: str,
    frontend_url: str = "http://localhost:5173"
):
    """Notification email for an existing customer about a new report."""
    subject = f"Inspection Report Ready for SRF No: {srf_no}"
    redirect_path = f"/portal/inwards/{inward_id}"
    query_params = urlencode({"redirect": redirect_path})
    full_login_link = f"{frontend_url}/login?{query_params}"

    template_body = {
        "title": "New Inspection Report Available",
        "srf_no": srf_no,
        "login_link": full_login_link,
    }

    await send_email(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        template_name="inward_notification.html",
        template_body=template_body
    )
