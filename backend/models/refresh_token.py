# backend/models/refresh_token.py

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from zoneinfo import ZoneInfo

# 🛑 Import your base class (e.g., from your project's database setup)
from backend.db import Base 
from backend.core.config import settings

# Avoid circular imports during runtime by using TYPE_CHECKING
if TYPE_CHECKING:
    from .users import User # Assuming your User model is in backend/models/user.py

LOCAL_TIMEZONE = ZoneInfo(settings.TIMEZONE)


class RefreshToken(Base):
    """SQLAlchemy model for the refresh_tokens table."""
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id"), 
        nullable=False,
        index=True
    )
    # Token column maps to VARCHAR(500)
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False) 
    expiry_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    # Maps to INTEGER DEFAULT 0 in SQL
    is_revoked: Mapped[Optional[int]] = mapped_column(default=0) 
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(LOCAL_TIMEZONE),
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP")
    )

    # Relationship to the User model
    user: Mapped["User"] = relationship(back_populates="refresh_tokens")
    
    def __repr__(self) -> str:
        return f"RefreshToken(user_id={self.user_id}, expiry_time={self.expiry_time}, revoked={self.is_revoked})"