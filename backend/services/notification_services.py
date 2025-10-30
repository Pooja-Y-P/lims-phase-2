from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_
from fastapi import HTTPException, BackgroundTasks

from backend.models.notifications import Notification
from backend.models.inward import Inward
from backend.models.users import User
from backend.core.email import send_email_with_logging

class NotificationService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_failed_notifications(self, created_by: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get all failed notifications with related inward and user data."""
        query = select(Notification, Inward, User).outerjoin(
            Inward, Notification.inward_id == Inward.inward_id
        ).outerjoin(
            User, Notification.recipient_user_id == User.user_id
        ).where(
            Notification.status == "failed"
        )
        
        if created_by:
            query = query.where(Notification.created_by == created_by)
        
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        
        results = self.db.execute(query).all()
        
        failed_notifications = []
        for notification, inward, user in results:
            failed_notifications.append({
                "id": notification.id,
                "recipient_email": notification.to_email,
                "recipient_user_id": notification.recipient_user_id,
                "recipient_name": user.full_name if user else None,
                "subject": notification.subject,
                "body_text": notification.body_text,
                "error": notification.error,
                "created_at": notification.created_at.isoformat(),
                "created_by": notification.created_by,
                "inward_id": notification.inward_id,
                "srf_no": inward.srf_no if inward else None,
                "customer_details": inward.customer_details if inward else None,
                "status": notification.status
            })
        
        return failed_notifications
    
    def get_notification_by_id(self, notification_id: int) -> Optional[Notification]:
        """Get a specific notification by ID."""
        return self.db.get(Notification, notification_id)
    
    async def retry_failed_notification(
        self, 
        notification_id: int, 
        background_tasks: BackgroundTasks,
        new_email: str = None
    ) -> bool:
        """Retry sending a failed notification."""
        notification = self.get_notification_by_id(notification_id)
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        if notification.status != "failed":
            raise HTTPException(status_code=400, detail="Only failed notifications can be retried")
        
        # Use new email if provided, otherwise use original
        recipient_email = new_email or notification.to_email
        
        if not recipient_email:
            raise HTTPException(status_code=400, detail="No recipient email available")
        
        # Create a simple template for retry
        template_body = {
            "title": "LIMS Notification",
            "message": "This is a retry of a previously failed notification.",
            "original_subject": notification.subject,
            "original_content": notification.body_text
        }
        
        # Update the notification to pending status
        notification.status = "pending"
        notification.to_email = recipient_email
        notification.error = None
        self.db.commit()
        
        # Try to send with a generic template
        success = await send_email_with_logging(
            background_tasks=background_tasks,
            subject=notification.subject,
            recipient=recipient_email,
            template_name="generic_notification.html",  # We'll need this template
            template_body=template_body,
            db=self.db,
            recipient_user_id=notification.recipient_user_id,
            inward_id=notification.inward_id,
            created_by=f"retry_{notification.created_by}"
        )
        
        return success
    
    def get_notification_stats(self, created_by: str = None) -> Dict[str, int]:
        """Get notification statistics."""
        base_query = select(Notification)
        
        if created_by:
            base_query = base_query.where(Notification.created_by == created_by)
        
        # Get counts for different statuses
        total = len(self.db.execute(base_query).scalars().all())
        
        pending = len(self.db.execute(
            base_query.where(Notification.status == "pending")
        ).scalars().all())
        
        success = len(self.db.execute(
            base_query.where(Notification.status == "success")
        ).scalars().all())
        
        failed = len(self.db.execute(
            base_query.where(Notification.status == "failed")
        ).scalars().all())
        
        return {
            "total": total,
            "pending": pending,
            "success": success,
            "failed": failed
        }
    
    def mark_notification_as_read(self, notification_id: int) -> bool:
        """Mark a notification as read/handled."""
        notification = self.get_notification_by_id(notification_id)
        if notification:
            # You could add a 'read' field to the notification model if needed
            # For now, we'll just update the status if it was failed
            if notification.status == "failed":
                notification.error = f"{notification.error} [MARKED AS HANDLED]"
                self.db.commit()
            return True
        return False
    
    def delete_notification(self, notification_id: int) -> bool:
        """Delete a notification (use with caution)."""
        notification = self.get_notification_by_id(notification_id)
        if notification:
            self.db.delete(notification)
            self.db.commit()
            return True
        return False