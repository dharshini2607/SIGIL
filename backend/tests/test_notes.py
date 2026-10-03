import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def setup_alert():
    from app.core.database import SessionLocal
    from app.models.alert import Alert
    db = SessionLocal()
    if not db.query(Alert).filter_by(id='ALT-001').first(): db.add(Alert(id='ALT-001', title='Test Alert', severity='LOW')); db.commit()

def get_auth_headers(username, password):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_analyst_can_create_and_read_note():
    setup_alert()
    # Log in as analyst
    headers = get_auth_headers("analyst", "analyst123")
    
    # Create note
    res = client.post("/api/v1/notes/by-alert/ALT-001", json={"content": "This is a test note."}, headers=headers)
    assert res.status_code == 200
    note_id = res.json()["note_id"]
    
    # Read notes
    res = client.get("/api/v1/notes/by-alert/ALT-001", headers=headers)
    assert res.status_code == 200
    notes = res.json()
    assert len(notes) > 0
    assert any(n["id"] == note_id and n["content"] == "This is a test note." for n in notes)

def test_viewer_cannot_create_note():
    setup_alert()
    headers = get_auth_headers("viewer", "viewer123")
    res = client.post("/api/v1/notes/by-alert/ALT-001", json={"content": "Viewer hack attempt"}, headers=headers)
    assert res.status_code == 403

def test_analyst_cannot_edit_other_note():
    setup_alert()
    # Admin creates note
    admin_headers = get_auth_headers("admin", "admin123")
    res = client.post("/api/v1/notes/by-alert/ALT-001", json={"content": "Admin secret"}, headers=admin_headers)
    note_id = res.json()["note_id"]
    
    # Analyst tries to edit Admin's note
    analyst_headers = get_auth_headers("analyst", "analyst123")
    res = client.patch(f"/api/v1/notes/{note_id}", json={"content": "Hacked"}, headers=analyst_headers)
    assert res.status_code == 403

def test_admin_can_edit_other_note():
    setup_alert()
    # Analyst creates note
    analyst_headers = get_auth_headers("analyst", "analyst123")
    res = client.post("/api/v1/notes/by-alert/ALT-001", json={"content": "Analyst observation"}, headers=analyst_headers)
    note_id = res.json()["note_id"]
    
    # Admin edits Analyst's note
    admin_headers = get_auth_headers("admin", "admin123")
    res = client.patch(f"/api/v1/notes/{note_id}", json={"content": "Admin correction"}, headers=admin_headers)
    assert res.status_code == 200
