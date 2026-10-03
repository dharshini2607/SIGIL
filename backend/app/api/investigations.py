import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.investigation import Investigation, InvestigationFinding, Evidence, AgentAudit
from app.models.alert import Alert
from app.agent.orchestrator import InvestigationOrchestrator
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User
import datetime
import uuid
import json
import traceback

from app.models.audit import SystemAudit

router = APIRouter()
analyst_only = RoleChecker(["SOC_ANALYST", "SENIOR_ANALYST", "SECURITY_ADMIN"])

def log_system_audit(db, user, action, result, alert_id=None, meta=None):
    sa = SystemAudit(user_id=user.id, username=user.username, action=action, result=result, alert_id=alert_id, metadata_info=meta)
    db.add(sa)
    db.commit()

def create_audit(db, inv_id, timestamp, tool, action, in_sum, res_sum, status, duration):
    log = AgentAudit(
        id=f"AUD-{uuid.uuid4().hex[:8]}", investigation_id=inv_id, timestamp=timestamp,
        tool_name=tool, action=action, input_summary=in_sum, result_summary=res_sum,
        status=status, duration_ms=duration
    )
    db.add(log)
    db.commit()

@router.get("/")
def get_investigations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Investigation).order_by(Investigation.created_at.desc()).all()

@router.post("/run/{alert_id}")
def run_investigation(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    try:
        log_system_audit(db, current_user, "INVESTIGATION_STARTED", "SUCCESS", alert_id)
        return InvestigationOrchestrator.run_investigation(db, alert_id)
    except ValueError as val_err:
        if "HTTP_409" in str(val_err):
            raise HTTPException(status_code=409, detail="Duplicate investigation attempt prevented.")
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        log_system_audit(db, current_user, "INVESTIGATION_FAILED", "FAILED", alert_id, {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retry/{alert_id}")
def retry_investigation(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    try:
        log_system_audit(db, current_user, "INVESTIGATION_RETRIED", "SUCCESS", alert_id)
        return InvestigationOrchestrator.run_investigation(db, alert_id)
    except ValueError as val_err:
        if "HTTP_409" in str(val_err):
            raise HTTPException(status_code=409, detail="Duplicate investigation attempt prevented.")
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        log_system_audit(db, current_user, "INVESTIGATION_FAILED", "FAILED", alert_id, {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-alert/{alert_id}")
def get_investigation(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    investigation = db.query(Investigation).filter(Investigation.alert_id == alert_id).first()
    if not investigation:
        raise HTTPException(status_code=404, detail="Investigation not found")
    return investigation

@router.get("/{investigation_id}/audit")
def get_audit_logs(investigation_id: str, db: Session = Depends(get_db)):
    return db.query(AgentAudit).filter(AgentAudit.investigation_id == investigation_id).order_by(AgentAudit.timestamp.asc()).all()
