# backend/services/delayed_email_service.py

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from fastapi import BackgroundTasks

from backend.models.delayed_email_tasks import DelayedEmailTask
from backend.models.inward import Inward
from backend.models.users import User
from backend.core.email import get_reminder_email_template, send_email_task

class DelayedEmailService:
    def __init__(self, db: Session):
        self.db = db
    
    # FIX: Changed to async for consistency
    async def schedule_delayed_email(
        self, 
        inward_id: int, 
        creator_id: int,
        recipient_email: Optional[str] = None,
        delay_hours: int = 24
    ) -> DelayedEmailTask:
        """Schedule a delayed email task."""
        scheduled_time = datetime.now(timezone.utc) + timedelta(hours=delay_hours)
        
        task = DelayedEmailTask(
            inward_id=inward_id,
            recipient_email=recipient_email,
            scheduled_at=scheduled_time,
            created_by=creator_id
        )
        
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        
        return task
    
    # FIX: This is the primary method causing the error. Changed to async.
    async def get_pending_tasks_for_user(self, creator_id: int) -> List[Dict[str, Any]]:
        """Get pending email tasks for a specific user with countdown info."""
        stmt = (
            select(DelayedEmailTask, Inward)
            .join(Inward, DelayedEmailTask.inward_id == Inward.inward_id)
            .where(
                and_(
                    DelayedEmailTask.created_by == creator_id,
                    DelayedEmailTask.is_sent == False,
                    DelayedEmailTask.is_cancelled == False
                )
            )
            .order_by(DelayedEmailTask.scheduled_at.asc())
        )
        
        results = self.db.execute(stmt).all()
        tasks = []
        
        now = datetime.now(timezone.utc)

        for task, inward in results:
            time_left = (task.scheduled_at - now).total_seconds()
            is_overdue = time_left < 0
            
            tasks.append({
                "id": task.id,
                "inward_id": inward.inward_id,
                "srf_no": inward.srf_no,
                "customer_details": inward.customer_details,
                "recipient_email": task.recipient_email,
                "scheduled_at": task.scheduled_at.isoformat(),
                "time_left_seconds": max(0, int(time_left)),
                "is_overdue": is_overdue,
                "created_at": task.created_at.isoformat()
            })
        
        return tasks
    
    # FIX: Changed to async for consistency
    async def get_task_by_id(self, task_id: int) -> Optional[DelayedEmailTask]:
        """Retrieves a single delayed email task by its ID."""
        return self.db.get(DelayedEmailTask, task_id)

    # FIX: Changed to async for consistency
    async def mark_task_as_sent(self, task_id: int) -> bool:
        """Mark a delayed email task as sent."""
        task = await self.get_task_by_id(task_id)
        if task and not task.is_sent:
            task.is_sent = True
            task.sent_at = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False
    
    # FIX: Changed to async for consistency
    async def cancel_task(self, task_id: int) -> bool:
        """Cancel a delayed email task."""
        task = await self.get_task_by_id(task_id)
        if task and not task.is_cancelled:
            task.is_cancelled = True
            self.db.commit()
            return True
        return False
    
    # FIX: Changed to async for consistency
    async def get_overdue_tasks(self) -> List[DelayedEmailTask]:
        """Get all overdue tasks that haven't sent reminders."""
        now = datetime.now(timezone.utc)
        one_hour_from_now = now + timedelta(hours=1)
        stmt = select(DelayedEmailTask).where(
            and_(
                DelayedEmailTask.scheduled_at < one_hour_from_now,
                DelayedEmailTask.is_sent == False,
                DelayedEmailTask.is_cancelled == False,
                DelayedEmailTask.reminder_sent == False
            )
        )
        
        return self.db.scalars(stmt).all()
    
    async def send_reminder_emails(self, background_tasks: BackgroundTasks):
        """Send reminder emails for tasks that are about to expire."""
        overdue_tasks = await self.get_overdue_tasks()
        
        tasks_by_creator: Dict[int, List[DelayedEmailTask]] = {}
        for task in overdue_tasks:
            creator_id = task.created_by
            if creator_id not in tasks_by_creator:
                tasks_by_creator[creator_id] = []
            tasks_by_creator[creator_id].append(task)
        
        for creator_id, tasks in tasks_by_creator.items():
            creator = self.db.get(User, creator_id)
            if creator and creator.email:
                template_data = get_reminder_email_template({
                    "engineer_name": creator.full_name or creator.username,
                    "pending_count": len(tasks),
                    "portal_link": "http://localhost:5173/engineer"
                })
                
                await send_email_task(
                    background_tasks=background_tasks,
                    subject=template_data["subject"],
                    recipient=creator.email,
                    template_name=template_data["template_name"],
                    template_body=template_data["template_body"]
                )
                
                for task in tasks:
                    task.reminder_sent = True
        
        if tasks_by_creator:
            self.db.commit()