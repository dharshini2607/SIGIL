from sqlalchemy import Column, String, DateTime, JSON, ForeignKey
from app.core.database import Base
import datetime
import uuid

class SystemAudit(Base):
    __tablename__ = "system_audit_logs"

    id = Column(String, primary_key=True, default=lambda: f"SAUD-{uuid.uuid4().hex[:8]}")
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    username = Column(String, nullable=True)
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action = Column(String, nullable=False) # e.g. ALERT_VIEWED, INVESTIGATION_STARTED
    result = Column(String, nullable=False)
    metadata_info = Column(JSON, nullable=True)
