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
    
    # FIX: Changed to async def to match the 'await' call in the router.
    async def get_failed_notifications(self, created_by: str = None, limit: int = 50) -> List[Dict[str, Any]]:
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
    
    # FIX: Changed to async for consistency.
    async def get_notification_by_id(self, notification_id: int) -> Optional[Notification]:
        """Get a specific notification by ID."""
        return self.db.get(Notification, notification_id)
    
    async def retry_failed_notification(
        self, 
        notification_id: int, 
        background_tasks: BackgroundTasks,
        new_email: str = None
    ) -> bool:
        """Retry sending a failed notification."""
        # This method uses await, so it must be async.
        notification = await self.get_notification_by_id(notification_id)
        
        if not notification:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        if notification.status != "failed":
            raise HTTPException(status_code=400, detail="Only failed notifications can be retried")
        
        recipient_email = new_email or notification.to_email
        
        if not recipient_email:
            raise HTTPException(status_code=400, detail="No recipient email available")
        
        template_body = {
            "title": "LIMS Notification",
            "message": "This is a retry of a previously failed notification.",
            "original_subject": notification.subject,
            "original_content": notification.body_text
        }
        
        notification.status = "pending"
        notification.to_email = recipient_email
        notification.error = None
        self.db.commit()
        
        success = await send_email_with_logging(
            background_tasks=background_tasks,
            subject=notification.subject,
            recipient=recipient_email,
            template_name="generic_notification.html",
            template_body=template_body,
            db=self.db,
            recipient_user_id=notification.recipient_user_id,
            inward_id=notification.inward_id,
            created_by=f"retry_{notification.created_by}"
        )
        
        return success
    
    # FIX: Changed to async def to match the 'await' call in the router.
    async def get_notification_stats(self, created_by: str = None) -> Dict[str, int]:
        """Get notification statistics."""
        # Using a single, more efficient query for stats
        from sqlalchemy import func, case

        stmt = select(
            func.count(Notification.id).label("total"),
            func.count(case((Notification.status == 'pending', 1))).label("pending"),
            func.count(case((Notification.status == 'success', 1))).label("success"),
            func.count(case((Notification.status == 'failed', 1))).label("failed"),
        )
        if created_by:
            stmt = stmt.where(Notification.created_by == created_by)

        stats = self.db.execute(stmt).first()
        
        return {
            "total": stats.total or 0,
            "pending": stats.pending or 0,
            "success": stats.success or 0,
            "failed": stats.failed or 0
        }
    
    # FIX: Changed to async for consistency.
    async def mark_notification_as_read(self, notification_id: int) -> bool:
        """Mark a notification as read/handled."""
        notification = await self.get_notification_by_id(notification_id)
        if notification:
            if notification.status == "failed":
                notification.error = f"{notification.error} [MARKED AS HANDLED]"
                self.db.commit()
            return True
        return False
    
    # FIX: Changed to async for consistency.
    async def delete_notification(self, notification_id: int) -> bool:
        """Delete a notification (use with caution)."""
        notification = await self.get_notification_by_id(notification_id)
        if notification:
            self.db.delete(notification)
            self.db.commit()
            return True
        return False