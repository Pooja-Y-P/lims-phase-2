# backend/models/user.py

from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
# 🛑 CORRECTED IMPORTS: Need String, Text to define column types
from sqlalchemy import ForeignKey, String, Text 
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from backend.db import Base 

# 🛑 Import the necessary token models
from .password_reset_token import PasswordResetToken
from .refresh_token import RefreshToken

# Use TYPE_CHECKING to prevent circular imports during runtime
if TYPE_CHECKING:
    # Ensure correct singular/plural naming convention for imports (e.g., 'customer' not 'customers')
    from .customers import Customer 
    from .inward import Inward
    from .notifications import Notification
    from .invitations import Invitation


class User(Base):
    """SQLAlchemy 2.0 model for the users table."""
    __tablename__ = "users"

    # --- Core Columns ---
    user_id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("customers.customer_id", ondelete="SET NULL")
    )
    
    # 🚀 FIX: Replaced text("VARCHAR(150)") with String(150)
    username: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    
    # 🚀 FIX: Replaced text("VARCHAR(320)") with String(320)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    
    # 🚀 FIX: Replaced text("TEXT") with Text
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 🚀 FIX: Replaced text("VARCHAR(255)") with String(255)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    
    # 🚀 FIX: Replaced text("VARCHAR(50)") with String(50)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    
    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), 
        nullable=False
    )
    # onupdate is typically sufficient for updated_at, no need for server_default here.
    updated_at: Mapped[Optional[datetime]] = mapped_column(onupdate=func.now()) 

    # --- Relationships ---
    
    # 1. Customer (Many-to-One)
    customer: Mapped["Customer"] = relationship(back_populates="users")
    
    # 2. Inwards (One-to-Many - Multiple FKs)
    inwards_received: Mapped[List["Inward"]] = relationship(
        foreign_keys="[Inward.received_by]", 
        back_populates="receiver"
    )
    inwards_created: Mapped[List["Inward"]] = relationship(
        foreign_keys="[Inward.created_by]", 
        back_populates="creator"
    )
    inwards_updated: Mapped[List["Inward"]] = relationship(
        foreign_keys="[Inward.updated_by]", 
        back_populates="updater"
    )
    
    # 3. Notifications (One-to-Many)
    notifications: Mapped[List["Notification"]] = relationship(
        back_populates="recipient", 
        cascade="all, delete-orphan"
    )
    
    # 4. Invitations (One-to-Many)
    invitations_created: Mapped[List["Invitation"]] = relationship(
        back_populates="creator", 
        foreign_keys="[Invitation.created_by]"
    )
    
    # 5. Password Reset Tokens (One-to-Many)
    password_reset_tokens: Mapped[List["PasswordResetToken"]] = relationship(
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    
    # 6. Refresh Tokens (One-to-Many)
    refresh_tokens: Mapped[List["RefreshToken"]] = relationship(
        back_populates="user", 
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"User(id={self.user_id}, username='{self.username}', role='{self.role}')"