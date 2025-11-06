# backend/services/delayed_email_service.py

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from fastapi import BackgroundTasks
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from backend.models.delayed_email_tasks import DelayedEmailTask
from backend.models.inward import Inward
from backend.models.users import User
from backend.core.email import get_reminder_email_template, send_email_task

logger = logging.getLogger(__name__)

class DelayedEmailService:
    def __init__(self, db: Session):
        self.db = db

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
        # The calling service (InwardService) is responsible for the commit
        # to ensure both Notification and DelayedEmailTask are saved together.
        return task

    # === THIS IS THE NEW METHOD THAT WAS MISSING ===
    async def get_all_pending_tasks(self) -> List[Dict[str, Any]]:
        """
        Gets all pending (not sent, not cancelled) tasks for ALL users.
        This is what the Engineer Portal should see.
        """
        try:
            now = datetime.now(timezone.utc)
            stmt = (
                select(DelayedEmailTask, Inward.srf_no, Inward.customer_details)
                .join(Inward, DelayedEmailTask.inward_id == Inward.inward_id)
                .where(
                    and_(
                        DelayedEmailTask.is_sent == False,
                        DelayedEmailTask.is_cancelled == False
                    )
                )
                .order_by(DelayedEmailTask.scheduled_at.asc())
            )
            results = self.db.execute(stmt).all()

            tasks_list = []
            for task, srf_no, customer_details in results:
                time_left = task.scheduled_at - now
                tasks_list.append({
                    "id": task.id,
                    "inward_id": task.inward_id,
                    "srf_no": str(srf_no),
                    "customer_details": customer_details,
                    "recipient_email": task.recipient_email,
                    "scheduled_at": task.scheduled_at,
                    "created_at": task.created_at,
                    "time_left_seconds": int(time_left.total_seconds()) if time_left.total_seconds() > 0 else 0,
                    "is_overdue": time_left.total_seconds() <= 0
                })
            return tasks_list
        except Exception as e:
            logger.error(f"Error fetching all pending tasks: {e}", exc_info=True)
            return []

    # This method can be kept if you need it elsewhere, but the portal uses the one above.
    async def get_pending_tasks_for_user(self, creator_id: int) -> List[Dict[str, Any]]:
        """Get pending email tasks for a specific user with countdown info."""
        stmt = (
            select(DelayedEmailTask, Inward)
            .join(Inward, DelayedEmailTask.inward_id == Inward.inward_id)
            .where(and_(
                DelayedEmailTask.created_by == creator_id,
                DelayedEmailTask.is_sent == False,
                DelayedEmailTask.is_cancelled == False
            )).order_by(DelayedEmailTask.scheduled_at.asc())
        )
        results = self.db.execute(stmt).all()
        tasks = []
        now = datetime.now(timezone.utc)
        for task, inward in results:
            time_left_seconds = (task.scheduled_at - now).total_seconds()
            tasks.append({
                "id": task.id,
                "inward_id": inward.inward_id,
                "srf_no": str(inward.srf_no),
                "customer_details": inward.customer_details,
                "recipient_email": task.recipient_email,
                "scheduled_at": task.scheduled_at,
                "time_left_seconds": max(0, int(time_left_seconds)),
                "is_overdue": time_left_seconds < 0,
                "created_at": task.created_at
            })
        return tasks

    async def get_task_by_id(self, task_id: int) -> Optional[DelayedEmailTask]:
        """Retrieves a single delayed email task by its ID."""
        return self.db.get(DelayedEmailTask, task_id)

    async def mark_task_as_sent(self, task_id: int) -> bool:
        """Mark a delayed email task as sent."""
        task = await self.get_task_by_id(task_id)
        if task and not task.is_sent:
            task.is_sent = True
            task.sent_at = datetime.now(timezone.utc)
            self.db.commit()
            return True
        return False

    async def cancel_task(self, task_id: int) -> bool:
        """Cancel a delayed email task."""
        task = await self.get_task_by_id(task_id)
        if task and not task.is_cancelled:
            task.is_cancelled = True
            task.updated_at = datetime.now(timezone.utc) # Good practice to add this
            self.db.commit()
            return True
        return False

    async def get_overdue_tasks(self) -> List[DelayedEmailTask]:
        """Get all overdue tasks that haven't sent reminders."""
        now = datetime.now(timezone.utc)
        one_hour_from_now = now + timedelta(hours=1)
        stmt = select(DelayedEmailTask).where(and_(
            DelayedEmailTask.scheduled_at < one_hour_from_now,
            DelayedEmailTask.is_sent == False,
            DelayedEmailTask.is_cancelled == False,
            DelayedEmailTask.reminder_sent == False
        ))
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
        
        if not tasks_by_creator:
            return

        for creator_id, tasks in tasks_by_creator.items():
            creator = self.db.get(User, creator_id)
            if creator and creator.email:
                template_data = get_reminder_email_template({
                    "engineer_name": creator.full_name or creator.username,
                    "pending_count": len(tasks),
                    "portal_link": "http://localhost:5173/engineer" # Use an environment variable for this in production
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
        
        self.db.commit()