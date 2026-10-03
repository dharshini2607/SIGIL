from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.alert import Alert
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User
from app.models.audit import SystemAudit
from app.models.investigation import Investigation
from pydantic import BaseModel
import datetime

router = APIRouter()
analyst_only = RoleChecker(["SOC_ANALYST", "SENIOR_ANALYST", "SECURITY_ADMIN"])
senior_only = RoleChecker(["SENIOR_ANALYST", "SECURITY_ADMIN"])

def log_system_audit(db, user, action, result, alert_id=None, meta=None):
    sa = SystemAudit(user_id=user.id, username=user.username, action=action, result=result, alert_id=alert_id, metadata_info=meta)
    db.add(sa)
    db.commit()

class AssignRequest(BaseModel):
    user_id: str

class AlertResponse(BaseModel):
    id: str
    title: str
    rule: Optional[str] = None
    severity: str
    status: str
    risk_score: Optional[float] = None
    confidence: Optional[float] = None
    created_at: datetime.datetime
    investigation_id: Optional[str] = None
    
    assigned_to_id: Optional[str] = None
    assigned_by_id: Optional[str] = None
    assigned_at: Optional[datetime.datetime] = None
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[AlertResponse])
def get_alerts(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=500),
    search: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    sort_by: Optional[str] = Query("timestamp"),
    sort_desc: bool = True
):
    query = db.query(Alert)
    
    if search:
        query = query.filter((Alert.title.ilike(f"%{search}%")) | (Alert.rule.ilike(f"%{search}%")))
    if severity:
        query = query.filter(Alert.severity == severity)
    if status:
        query = query.filter(Alert.status == status)
        
    if sort_by == "risk":
        query = query.order_by(Alert.risk_score.desc() if sort_desc else Alert.risk_score.asc())
    else:
        query = query.order_by(Alert.created_at.desc() if sort_desc else Alert.created_at.asc())
        
    return query.offset(skip).limit(limit).all()

@router.get("/{alert_id}")
def get_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert

@router.post("/{alert_id}/mark_investigated")
def mark_investigated(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    if alert.status == "CLOSED":
        raise HTTPException(status_code=400, detail="Cannot mark a closed alert as investigated.")
        
    old_status = alert.status
    alert.status = "INVESTIGATED"
    log_system_audit(db, current_user, "MANUAL_MARK_INVESTIGATED", "SUCCESS", alert_id, {"old_status": old_status})
    db.commit()
    return {"message": "Success"}

@router.post("/{alert_id}/close")
def close_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(senior_only)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    old_status = alert.status
    alert.status = "CLOSED"
    log_system_audit(db, current_user, "MANUAL_CLOSE", "SUCCESS", alert_id, {"old_status": old_status})
    db.commit()
    return {"message": "Success"}

@router.post("/{alert_id}/assignment")
def assign_alert(alert_id: str, assign_req: AssignRequest, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    target_user = db.query(User).filter(User.id == assign_req.user_id, User.is_active == True).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Eligible active user not found")
        
    if target_user.role == "VIEWER":
        raise HTTPException(status_code=400, detail="Cannot assign alerts to VIEWER accounts")

    action = "ALERT_REASSIGNED" if alert.assigned_to_id else "ALERT_ASSIGNED"
    old_assignee = alert.assigned_to_id
    
    alert.assigned_to_id = target_user.id
    alert.assigned_by_id = current_user.id
    alert.assigned_at = datetime.datetime.utcnow()
    
    log_system_audit(db, current_user, action, "SUCCESS", alert_id, {"old_assignee": old_assignee, "new_assignee": target_user.id})
    db.commit()
    db.refresh(alert)
    return alert

@router.delete("/{alert_id}/assignment")
def unassign_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    old_assignee = alert.assigned_to_id
    alert.assigned_to_id = None
    alert.assigned_by_id = None
    alert.assigned_at = None
    
    log_system_audit(db, current_user, "ALERT_UNASSIGNED", "SUCCESS", alert_id, {"old_assignee": old_assignee})
    db.commit()
    db.refresh(alert)
    return alert

