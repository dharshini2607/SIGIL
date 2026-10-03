from sqlalchemy import Column, String, Integer, DateTime, JSON, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, index=True) # e.g. ALT-001
    title = Column(String)
    rule = Column(String)
    severity = Column(String, index=True) # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, index=True, default="NEW") # NEW, INVESTIGATING, INVESTIGATED, FAILED, CLOSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    risk_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    
    entities = Column(JSON) # List of entity IDs involved
    related_event_ids = Column(JSON) # List of event IDs triggering this alert
    
    investigation_id = Column(String, ForeignKey("investigations.id", use_alter=True), nullable=True)
    investigation = relationship("Investigation", back_populates="alert", primaryjoin="Alert.id == Investigation.alert_id", foreign_keys="[Investigation.alert_id]")

    # Assignment Tracking
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    
    # Relationships
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    notes = relationship("Note", back_populates="alert", cascade="all, delete-orphan")
