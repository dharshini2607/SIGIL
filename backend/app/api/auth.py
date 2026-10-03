from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User, AuthAudit
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user
from pydantic import BaseModel
import datetime

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str
    
@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    
    if not user or not verify_password(req.password, user.password_hash):
        if user:
            audit = AuthAudit(user_id=user.id, username=req.username, action="LOGIN_FAILURE", result="FAILED", metadata_info="Invalid password")
            db.add(audit)
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
        
    if not user.is_active:
        audit = AuthAudit(user_id=user.id, username=req.username, action="LOGIN_FAILURE", result="FAILED", metadata_info="Account disabled")
        db.add(audit)
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
        
    access_token = create_access_token(data={"sub": user.username})
    user.last_login_at = datetime.datetime.utcnow()
    
    audit = AuthAudit(user_id=user.id, username=user.username, action="LOGIN_SUCCESS", result="SUCCESS")
    db.add(audit)
    db.commit()
    
    response.set_cookie(key="access_token", value=f"Bearer {access_token}", httponly=True, secure=False, samesite="lax", max_age=3600*24)

    
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    audit = AuthAudit(user_id=current_user.id, username=current_user.username, action="LOGOUT", result="SUCCESS")
    db.add(audit)
    db.commit()
    
    # Must clear cookie natively
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active
    }
