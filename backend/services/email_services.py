from fastapi import BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import Dict, Any, Optional
from pathlib import Path
from urllib.parse import urlencode

# Import the centralized settings instance from your config file
from backend.core.config import settings

# --- 1. Create the Mail Connection Configuration ---
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

# --- 2. Generic Email Sending Function ---
async def send_email(
    subject: str,
    recipient: EmailStr,
    template_name: str,
    template_body: Dict[str, Any]
):
    try:
        message = MessageSchema(
            subject=subject,
            recipients=[recipient],
            template_body=template_body,
            subtype=MessageType.html
        )
        fm = FastMail(conf)
        await fm.send_message(message, template_name=template_name)
        print(f"Email '{subject}' sent successfully to {recipient}")
    except Exception as e:
        print(f"ERROR: Failed to send email to {recipient}. Error: {e}")

# --- 3. Invitation Email Function ---
async def send_invitation_email(
    email: EmailStr,
    name: str,
    role: str,
    temp_password: str,
    invitation_token: str,
    frontend_url: str = "http://localhost:3000"
):
    """Sends a role-based invitation email with temporary password."""
    
    # Role-specific subject lines and templates
    role_config = {
        "admin": {
            "subject": "Welcome to LIMS - Administrator Access Granted",
            "template": "invitation_admin.html",
            "role_description": "Administrator"
        },
        "engineer": {
            "subject": "Welcome to LIMS - Engineer Account Created",
            "template": "invitation_engineer.html", 
            "role_description": "Quality Engineer"
        },
        "customer": {
            "subject": "Welcome to LIMS - Customer Portal Access",
            "template": "invitation_customer.html",
            "role_description": "Customer"
        }
    }
    
    config = role_config.get(role.lower(), role_config["customer"])
    activation_link = f"{frontend_url}/activate?token={invitation_token}"
    
    template_body = {
        "name": name,
        "role": config["role_description"],
        "email": email,
        "temporary_password": temp_password,
        "activation_link": activation_link,
        "login_url": f"{frontend_url}/login",
        "expires_hours": 48
    }
    
    await send_email(
        subject=config["subject"],
        recipient=email,
        template_name=config["template"],
        template_body=template_body
    )

# --- 4. Welcome Email Function ---
async def send_welcome_email(
    email: EmailStr,
    name: str,
    role: str
):
    """Sends a welcome email after first successful login."""
    
    role_config = {
        "admin": {
            "subject": "Welcome to LIMS - Your Admin Dashboard Awaits",
            "template": "welcome_admin.html"
        },
        "engineer": {
            "subject": "Welcome to LIMS - Ready to Manage Quality",
            "template": "welcome_engineer.html"
        },
        "customer": {
            "subject": "Welcome to LIMS - Your Quality Partner",
            "template": "welcome_customer.html"
        }
    }
    
    config = role_config.get(role.lower(), role_config["customer"])
    
    template_body = {
        "name": name,
        "role": role.title(),
        "portal_url": "http://localhost:3000/dashboard"
    }
    
    await send_email(
        subject=config["subject"],
        recipient=email,
        template_name=config["template"],
        template_body=template_body
    )

# --- 5. Existing Functions (Updated) ---
async def send_new_user_invitation_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    token: str,
    srf_no: str,
    temp_password: str,
    frontend_url: str = "http://localhost:3000"
):
    """Sends an account activation email with a temporary password to a new customer."""
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

    background_tasks.add_task(
        send_email,
        subject=subject,
        recipient=recipient_email,
        template_name="new_customer_invitation.html",
        template_body=template_body,
    )

async def send_existing_user_notification_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    inward_id: int,
    srf_no: str,
    frontend_url: str = "http://localhost:3000"
):
    """Sends a notification to an existing customer with a proper login/redirect link."""
    subject = f"Inspection Report Ready for SRF No: {srf_no}"

    redirect_path = f"/portal/inwards/{inward_id}"
    query_params = urlencode({"redirect": redirect_path})
    full_login_link = f"{frontend_url}/login?{query_params}"

    template_body = {
        "title": "New Inspection Report Available",
        "srf_no": srf_no,
        "login_link": full_login_link,
    }

    background_tasks.add_task(
        send_email,
        subject=subject,
        recipient=recipient_email,
        template_name="inward_notification.html", 
        template_body=template_body,
    )

def get_password_reset_template(user_name: Optional[str], reset_link: str) -> Dict[str, Any]:
    """Generates the subject and body for the password reset email."""
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
    """Generates the content for the reminder email to the engineer."""
    pending_count = data.get("pending_count", 0)
    subject = f"URGENT: You have {pending_count} Unsent First Inspection Reports"
    template_name = "reminder_notification.html"
    template_body = {
        "title": "Action Required: Unsent Reports",
        "engineer_name": data.get("engineer_name", "Engineer"),
        "pending_count": pending_count,
        "portal_link": data.get("portal_link", "#"),
        "message": "This is a critical alert regarding overdue tasks that require your immediate action."
    }
    return {
        "subject": subject,
        "template_name": template_name,
        "template_body": template_body,
    }