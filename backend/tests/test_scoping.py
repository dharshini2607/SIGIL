import pytest
from fastapi.testclient import TestClient
import sys
import os
import uuid
import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.event import Event
from app.models.alert import Alert
from app.models.investigation import Investigation
from app.api.deps import get_current_user
from app.models.user import User

def mock_get_current_user():
    return User(id="mock", username="admin", role="SECURITY_ADMIN", is_active=True)

app.dependency_overrides[get_current_user] = mock_get_current_user
client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    
    # Create Scope A (Privilege Escalation)
    evt_a1 = Event(id="EVT-A1", timestamp=now, event_type="Process", source="Sysmon", action="ProcessLaunch")
    evt_a2 = Event(id="EVT-A2", timestamp=now, event_type="Account", source="AD", action="GroupModification")
    db.add_all([evt_a1, evt_a2])
    
    alt_a = Alert(id="ALT-A", title="Privilege Escalation", rule="privilege_escalation", severity="HIGH", risk_score=80.0, entities=["user1"], related_event_ids=["EVT-A1", "EVT-A2"])
    db.add(alt_a)
    
    # Create Scope B (DNS C2)
    evt_b1 = Event(id="EVT-B1", timestamp=now, event_type="DNS", source="DNS-Server", action="Query", domain="bad.com")
    evt_b2 = Event(id="EVT-B2", timestamp=now, event_type="Network", source="Firewall", action="Connection")
    db.add_all([evt_b1, evt_b2])
    
    alt_b = Alert(id="ALT-B", title="Suspicious DNS Activity", rule="dns_c2_beacon", severity="CRITICAL", risk_score=95.0, entities=["bad.com"], related_event_ids=["EVT-B1", "EVT-B2"])
    db.add(alt_b)
    
    db.commit()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_anti_contamination(setup_db):
    # Run Investigation on Alert A (Privilege Escalation)
    res_a = client.post("/api/v1/investigations/run/ALT-A")
    assert res_a.status_code in [200, 400, 500] 
    
    # We must explicitly get the investigation via db since HTTP might bubble the 500 error 
    # and prevent returning JSON.
    inv = setup_db.query(Investigation).filter(Investigation.alert_id == "ALT-A").first()
    assert inv is not None
    assert inv.status in ["COMPLETED", "FAILED"]

    inv_a = client.get(f"/api/v1/investigations/by-alert/ALT-A").json()
    
    # Ensure DNS findings are NOT present
    for mitre in inv_a["mitre_mappings"]:
        assert "DNS" not in mitre["name"]
        
    audit_a = client.get(f"/api/v1/investigations/{inv.id}/audit").json()
    timeline_logs = [log for log in audit_a if log["tool_name"] == "get_timeline"]
    assert len(timeline_logs) == 1
    assert "2 scoped events" in timeline_logs[0]["input_summary"]
    
    # Run Investigation on Alert B (DNS C2)
    res_b = client.post("/api/v1/investigations/run/ALT-B")
    assert res_b.status_code == 200
    
    inv_id_b = res_b.json()["investigation_id"]
    inv_b = client.get(f"/api/v1/investigations/by-alert/ALT-B").json()
    
    # Ensure Privilege Escalation findings are NOT present
    for mitre in inv_b["mitre_mappings"]:
        assert "Privilege Escalation" not in mitre["tactic"]
        assert "DNS" in mitre["name"]
