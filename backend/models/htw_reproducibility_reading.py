from sqlalchemy import (
    Column,
    Integer,
    Numeric,
    TIMESTAMP,
    ForeignKey,
    UniqueConstraint,
    func
)
from sqlalchemy.orm import relationship
from backend.db import Base


class HTWReproducibilityReading(Base):
    __tablename__ = "htw_reproducibility_reading"
    
    __table_args__ = (
        UniqueConstraint(
            "reproducibility_id",
            "reading_order",
            name="htw_reproducibility_reading_reproducibility_id_reading_orde_key"
        ),
        # Removed {"schema": "public"} to ensure consistency with ForeignKey lookups
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    # --- FIX: Removed 'public.' prefix ---
    reproducibility_id = Column(
        Integer,
        ForeignKey(
            "htw_reproducibility.id",  # Changed from "public.htw_reproducibility.id"
            ondelete="CASCADE"
        ),
        nullable=False
    )

    reading_order = Column(Integer, nullable=False)

    indicated_reading = Column(
        Numeric(14, 4),
        nullable=False
    )

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()
    )

    # 🔗 Relationship
    # Ensure HTWReproducibility model has: back_populates="readings"
    reproducibility = relationship(
        "HTWReproducibility",
        back_populates="readings"
    )