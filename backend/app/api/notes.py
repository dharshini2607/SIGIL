from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User
from app.models.note import Note
from app.models.alert import Alert

router = APIRouter()
analyst_only = RoleChecker(["SOC_ANALYST", "SENIOR_ANALYST", "SECURITY_ADMIN"])

class NoteCreate(BaseModel):
    content: str

class NoteUpdate(BaseModel):
    content: str

@router.get("/by-alert/{alert_id}")
def get_notes_for_alert(alert_id: str, db: Session = Depends(get_db)):
    notes = db.query(Note).filter(Note.alert_id == alert_id).order_by(Note.created_at.desc()).all()
    # Serialize securely
    result = []
    for n in notes:
        result.append({
            "id": n.id,
            "alert_id": n.alert_id,
            "author_id": n.author_id,
            "content": n.content,
            "created_at": n.created_at,
            "updated_at": n.updated_at,
            "author_name": n.author.full_name if n.author else "Unknown"
        })
    return result

@router.post("/by-alert/{alert_id}")
def create_note(alert_id: str, note_in: NoteCreate, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    if not note_in.content or not note_in.content.strip():
        raise HTTPException(status_code=422, detail="Note content cannot be empty")
        
    db_alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    new_note = Note(
        alert_id=alert_id,
        author_id=current_user.id,
        content=note_in.content
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)
    return {"status": "success", "note_id": new_note.id}

@router.patch("/{note_id}")
def update_note(note_id: str, note_in: NoteUpdate, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    # Check permissions strictly - Only authors or admins/seniors can edit
    if current_user.role == "SOC_ANALYST" and note.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify other users' notes")
        
    note.content = note_in.content
    db.commit()
    db.refresh(note)
    return {"status": "success", "note_id": note.id}

@router.delete("/{note_id}")
def delete_note(note_id: str, db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    # Check permissions strictly
    if current_user.role == "SOC_ANALYST" and note.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete other users' notes")
        
    db.delete(note)
    db.commit()
    return {"status": "success"}
