from sqlalchemy import Column, String, Integer, DateTime, JSON
from app.core.database import Base
import datetime

class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True) # e.g. EVT-102
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    event_type = Column(String, index=True) # e.g., Authentication, DNS, Network
    source = Column(String)
    action = Column(String)
    status = Column(String)
    
    src_ip = Column(String, nullable=True)
    dst_ip = Column(String, nullable=True)
    src_port = Column(Integer, nullable=True)
    dst_port = Column(Integer, nullable=True)
    
    username = Column(String, nullable=True)
    hostname = Column(String, nullable=True)
    process_name = Column(String, nullable=True)
    domain = Column(String, nullable=True)
    file_hash = Column(String, nullable=True)
    bytes_transferred = Column(Integer, nullable=True)
    
    raw_event = Column(JSON, nullable=True)
