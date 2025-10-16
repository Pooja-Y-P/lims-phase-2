# backend/models/password_reset_token.py

from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

# 🛑 Import your base class (e.g., from your project's database setup)
from backend.db import Base 

# Avoid circular imports during runtime by using TYPE_CHECKING
if TYPE_CHECKING:
    from .users import User # Assuming your User model is in backend/models/user.py

class PasswordResetToken(Base):
    """SQLAlchemy model for the password_reset_tokens table."""
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id"), 
        nullable=False,
        index=True
    )
    token: Mapped[str] = mapped_column(unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    
    # Maps to the BOOLEAN NOT NULL DEFAULT FALSE in SQL
    is_used: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=datetime.now, 
        server_default=text("NOW()")
    )

    # Relationship to the User model
    user: Mapped["User"] = relationship(back_populates="password_reset_tokens")

    def __repr__(self) -> str:
        return f"PasswordResetToken(user_id={self.user_id}, expires_at={self.expires_at})"