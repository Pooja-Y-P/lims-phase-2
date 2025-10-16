from fastapi import BackgroundTasks
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from typing import Dict, Any
from pathlib import Path

# Import the centralized settings instance from your config file
from backend.core.config import settings

# --- 1. Create the Mail Connection Configuration ---
# This object reads directly from your `settings` instance.
conf = ConnectionConfig(
    MAIL_USERNAME=settings.SMTP_USER,
    MAIL_PASSWORD=settings.SMTP_PASSWORD,
    MAIL_FROM=settings.FROM_EMAIL,
    MAIL_PORT=settings.SMTP_PORT,
    MAIL_SERVER=settings.SMTP_SERVER,
    MAIL_STARTTLS=True,  # Standard for port 587
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    # Define the location of your email templates
    TEMPLATE_FOLDER=Path(__file__).parent.parent / 'templates' / 'email'
)

# --- 2. Generic Email Sending Function ---
async def send_email(
    background_tasks: BackgroundTasks,
    subject: str,
    recipient: EmailStr,
    template_name: str,
    template_body: Dict[str, Any]
):
    """
    A reusable function to send an email in the background.

    Args:
        background_tasks: FastAPI's BackgroundTasks to send email without blocking.
        subject: The subject of the email.
        recipient: The email address of the recipient.
        template_name: The filename of the HTML template to use (e.g., 'invitation.html').
        template_body: A dictionary of variables to pass to the template.
    """
    try:
        message = MessageSchema(
            subject=subject,
            recipients=[recipient],
            template_body=template_body,
            subtype=MessageType.html
        )

        fm = FastMail(conf)
        
        # Add the sending task to the background to avoid blocking the API response
        background_tasks.add_task(
            fm.send_message, message, template_name=template_name
        )
        print(f"Email task for '{subject}' to {recipient} queued.")
    except Exception as e:
        # For production, you would replace this with proper logging (e.g., Sentry, Loguru)
        print(f"ERROR: Failed to queue email to {recipient}. Error: {e}")

# --- 3. Specific Email Senders for Your Application ---
async def send_customer_invitation_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    token: str,
    srf_no: int,
    # Assuming FRONTEND_URL is part of your config, if not, hardcode or pass it in
    frontend_url: str = "http://localhost:3000" # A sensible default for development
):
    """
    Sends the account activation email to a new customer.
    """
    subject = f"Action Required: Set Your Password for SRF No: {srf_no}"
    
    # Construct the full activation URL for your frontend application
    activation_link = f"{frontend_url}/portal/activate?token={token}"
    
    template_body = {
        "title": "Welcome! Please Activate Your Account",
        "srf_no": srf_no,
        "activation_link": activation_link,
        "valid_for_hours": settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 # Or a separate setting
    }
    
    await send_email(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        template_name="customer_invitation.html",
        template_body=template_body,
    )

async def send_inward_remarks_notification_email(
    background_tasks: BackgroundTasks,
    recipient_email: EmailStr,
    inward_id: int,
    srf_no: int,
    frontend_url: str = "http://localhost:3000" # Default for development
):
    """
    Sends a notification to an existing customer about a new inward requiring remarks.
    """
    subject = f"Action Required: Add Remarks for SRF No: {srf_no}"
    
    # Construct the link directly to the inward details page on your frontend
    remarks_link = f"{frontend_url}/portal/inwards/{inward_id}"
    
    template_body = {
        "title": "New Equipment Awaiting Your Review",
        "srf_no": srf_no,
        "remarks_link": remarks_link,
    }

    await send_email(
        background_tasks=background_tasks,
        subject=subject,
        recipient=recipient_email,
        template_name="inward_notification.html",
        template_body=template_body,
    )