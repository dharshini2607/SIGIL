from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.event import Event
from app.models.alert import Alert
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/")
def get_all_events(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Event).order_by(Event.timestamp.desc()).all()

@router.get("/by-alert/{alert_id}")
def get_events_for_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    events = db.query(Event).filter(Event.id.in_(alert.related_event_ids)).order_by(Event.timestamp.asc()).all()
    return events

@router.get("/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
         raise HTTPException(status_code=404, detail="Event not found")
    return event
