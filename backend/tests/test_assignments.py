import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_auth_headers(username, password):
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(scope="module")
def eligible_user_id():
    headers = get_auth_headers("admin", "admin123")
    res = client.get("/api/v1/users/eligible_analysts", headers=headers)
    assert res.status_code == 200
    return res.json()[0]["id"]

@pytest.mark.parametrize("username,password,expected_status", [
    ("analyst", "analyst123", 200),
    ("senior", "senior123", 200),
    ("admin", "admin123", 200),
    ("viewer", "viewer123", 403),
])
def test_role_based_assignment_lifecycle(username, password, expected_status, eligible_user_id):
    headers = get_auth_headers(username, password)
    
    # 1. Test Assignment / Reassignment
    res_assign = client.post("/api/v1/alerts/ALT-001/assignment", json={"user_id": eligible_user_id}, headers=headers)
    assert res_assign.status_code == expected_status
    if expected_status == 200:
        data = res_assign.json()
        assert data["assigned_to_id"] == eligible_user_id
        
        # 2. Test Unassignment
        res_unassign = client.delete("/api/v1/alerts/ALT-001/assignment", headers=headers)
        assert res_unassign.status_code == 200
        assert res_unassign.json()["assigned_to_id"] is None
        
def test_viewer_access_denied_to_eligible_analysts_list():
    headers = get_auth_headers("viewer", "viewer123")
    res = client.get("/api/v1/users/eligible_analysts", headers=headers)
    assert res.status_code == 403
