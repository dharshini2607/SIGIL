import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_headers(username, password):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_senior_can_close_alert():
    # Log in as senior
    headers = get_auth_headers("senior", "senior123")
    
    # Close alert
    res = client.post("/api/v1/alerts/ALT-001/close", headers=headers)
    assert res.status_code == 200
    
    # Verify closing
    res = client.get("/api/v1/alerts/ALT-001", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "CLOSED"

def test_analyst_cannot_close_alert():
    # Log in as analyst
    headers = get_auth_headers("analyst", "analyst123")
    
    # Close alert
    res = client.post("/api/v1/alerts/ALT-002/close", headers=headers)
    assert res.status_code == 403
