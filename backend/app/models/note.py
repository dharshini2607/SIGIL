from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
import datetime
import uuid
from app.core.database import Base

def generate_uuid():
    return uuid.uuid4().hex

class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    alert_id = Column(String, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    alert = relationship("Alert", back_populates="notes")
    author = relationship("User", backref="notes")
