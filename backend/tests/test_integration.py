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

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    now = datetime.datetime.utcnow()
    
    evt_a1 = Event(id="EVT-Q1", timestamp=now, event_type="Network", source="Firewall", action="Connection")
    db.add(evt_a1)
    
    alt_a = Alert(
        id="ALT-Q1", title="Test Routing Alert", rule="test_rule", 
        severity="HIGH", risk_score=90.0, entities=["test"], 
        related_event_ids=["EVT-Q1"], status="NEW"
    )
    db.add(alt_a)
    
    inv_a = Investigation(
        id="INV-Q1", alert_id="ALT-Q1", status="INVESTIGATING",
        created_at=now
    )
    db.add(inv_a)
    alt_a.investigation_id = "INV-Q1"
    
    db.commit()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_alert_flow(setup_db):
    # 2. Retrieves dashboard alerts
    res_dash = client.get("/api/v1/alerts/")
    assert res_dash.status_code == 200
    alerts = res_dash.json()
    assert len(alerts) >= 1
    
    # 3. Gets the returned alert ID
    target_id = None
    for a in alerts:
        if a["id"] == "ALT-Q1":
            target_id = a["id"]
            break
    assert target_id is not None
    
    # 4. Requests that alert by ID
    res_alert = client.get(f"/api/v1/alerts/{target_id}")
    assert res_alert.status_code == 200
    
    # 5. Verifies the alert is returned
    alert_detail = res_alert.json()
    assert alert_detail["id"] == target_id
    
    # 6. Retrieves its events
    res_events = client.get(f"/api/v1/events/by-alert/{target_id}")
    assert res_events.status_code == 200
    events = res_events.json()
    assert len(events) == 1
    
    # 7. Retrieves its investigation
    res_inv = client.get(f"/api/v1/investigations/by-alert/{target_id}")
    assert res_inv.status_code == 200
    
    # 8. Verifies all returned records reference the same alert ID
    inv = res_inv.json()
    assert inv["alert_id"] == target_id
    
    # Test invalid ID
    res_invalid = client.get("/api/v1/alerts/nonexistent")
    assert res_invalid.status_code == 404
