from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, AuthAudit
from app.api.deps import get_current_user, RoleChecker
from app.core.security import get_password_hash
from pydantic import BaseModel
import datetime

router = APIRouter()
admin_only = RoleChecker(["SECURITY_ADMIN"])
analyst_only = RoleChecker(["SOC_ANALYST", "SENIOR_ANALYST", "SECURITY_ADMIN"])

class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    full_name: str
    role: str

class UserUpdate(BaseModel):
    role: str = None
    is_active: bool = None

@router.get("/")
def get_users(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active, "full_name": u.full_name, "last_login_at": u.last_login_at} for u in users]

@router.get("/eligible_analysts")
def get_eligible_analysts(db: Session = Depends(get_db), current_user: User = Depends(analyst_only)):
    users = db.query(User).filter(
        User.is_active != False,
        User.role.in_(["SOC_ANALYST", "SENIOR_ANALYST", "SECURITY_ADMIN"])
    ).all()
    return [{"id": u.id, "username": u.username, "role": u.role, "full_name": u.full_name} for u in users]

@router.post("/")
def create_user(req: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        password_hash=get_password_hash(req.password),
        role=req.role
    )
    db.add(user)
    db.commit()
    return {"id": user.id, "username": user.username}

@router.patch("/{user_id}")
def update_user(user_id: str, req: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
        
    active_admins = db.query(User).filter(User.role == "SECURITY_ADMIN", User.is_active == True).count()
    
    if target.role == "SECURITY_ADMIN":
        if req.is_active is False and active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot disable the last active SECURITY_ADMIN")
        if req.role and req.role != "SECURITY_ADMIN" and active_admins <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last active SECURITY_ADMIN")

    if req.role:
        audit = AuthAudit(user_id=target.id, username=target.username, action="ROLE_CHANGED", result="SUCCESS", metadata_info=f"{target.role} -> {req.role}")
        db.add(audit)
        target.role = req.role
        
    if req.is_active is not None and target.is_active != req.is_active:
        if not req.is_active:
            audit = AuthAudit(user_id=target.id, username=target.username, action="ACCOUNT_DISABLED", result="SUCCESS")
            db.add(audit)
        target.is_active = req.is_active
        
    db.commit()
    return {"id": target.id, "username": target.username, "role": target.role, "is_active": target.is_active}
