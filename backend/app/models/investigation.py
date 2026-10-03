from sqlalchemy import Column, String, Float, DateTime, JSON, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String, primary_key=True, index=True) # e.g. INV-001
    alert_id = Column(String, ForeignKey("alerts.id"), unique=True)
    status = Column(String, default="NEW") # NEW, INVESTIGATING, INVESTIGATED, FAILED, CLOSED
    failure_reason = Column(String, nullable=True) # PROVIDER_ERROR, TIMEOUT, etc.
    attempt_number = Column(Integer, default=1)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    verdict = Column(String, nullable=True)
    risk_score = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    executive_summary = Column(String, nullable=True)
    mitre_mappings = Column(JSON, nullable=True)
    recommended_actions = Column(JSON, nullable=True)
    uncertainty = Column(String, nullable=True)
    
    alert = relationship("Alert", back_populates="investigation", primaryjoin="Alert.id == Investigation.alert_id", foreign_keys="[Investigation.alert_id]")
    findings = relationship("InvestigationFinding", back_populates="investigation")
    audit_logs = relationship("AgentAudit", back_populates="investigation")

class InvestigationFinding(Base):
    __tablename__ = "investigation_findings"
    
    id = Column(String, primary_key=True, index=True)
    investigation_id = Column(String, ForeignKey("investigations.id"))
    title = Column(String)
    description = Column(String)
    
    investigation = relationship("Investigation", back_populates="findings")
    evidence = relationship("Evidence", back_populates="finding")

class Evidence(Base):
    __tablename__ = "evidence"
    
    id = Column(String, primary_key=True, index=True)
    finding_id = Column(String, ForeignKey("investigation_findings.id"))
    event_id = Column(String, ForeignKey("events.id")) # Ensures it maps to an actual event
    
    finding = relationship("InvestigationFinding", back_populates="evidence")

class AgentAudit(Base):
    __tablename__ = "agent_audit_logs"
    
    id = Column(String, primary_key=True, index=True)
    investigation_id = Column(String, ForeignKey("investigations.id"))
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    action = Column(String)
    tool_name = Column(String)
    input_summary = Column(String)
    result_summary = Column(String)
    status = Column(String)
    duration_ms = Column(Float)
    
    investigation = relationship("Investigation", back_populates="audit_logs")
