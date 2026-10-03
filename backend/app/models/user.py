from sqlalchemy import Column, String, Boolean, DateTime, text
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime
import uuid

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: f"USR-{uuid.uuid4().hex[:8]}")
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="VIEWER", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

class AuthAudit(Base):
    __tablename__ = "auth_audit_logs"

    id = Column(String, primary_key=True, default=lambda: f"AUD-{uuid.uuid4().hex[:8]}")
    user_id = Column(String, index=True, nullable=True)
    username = Column(String, index=True, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action = Column(String, nullable=False) # e.g. LOGIN_SUCCESS, LOGIN_FAILURE, ROLE_CHANGED, ACCOUNT_DISABLED
    result = Column(String, nullable=False)
    metadata_info = Column(String, nullable=True)
