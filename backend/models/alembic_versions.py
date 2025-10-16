from sqlalchemy import Column, String
from backend.db import Base

class AlembicVersion(Base):
    __tablename__ = "alembic_version"

    version_num = Column(String(32), primary_key=True)
