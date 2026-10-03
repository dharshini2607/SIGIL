from sqlalchemy import Column, String, DateTime
from app.core.database import Base
import datetime

class Entity(Base):
    __tablename__ = "entities"

    id = Column(String, primary_key=True, index=True) # e.g. ENT-001
    entity_type = Column(String, index=True) # IP, USER, HOST
    entity_value = Column(String, index=True)
    first_seen = Column(DateTime, default=datetime.datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.datetime.utcnow)
