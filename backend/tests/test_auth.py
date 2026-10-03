import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_login_success():
    response = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "analyst123"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.cookies.get("access_token") is not None

def test_login_invalid_password():
    response = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "wrongpassword"})
    assert response.status_code == 401

def test_login_unknown_user():
    response = client.post("/api/v1/auth/login", json={"username": "ghost", "password": "password"})
    assert response.status_code == 401

def test_unauthenticated_api_request():
    response = client.get("/api/v1/alerts/")
    assert response.status_code == 401

def test_authenticated_api_request():
    # Login
    resp = client.post("/api/v1/auth/login", json={"username": "viewer", "password": "viewer123"})
    token = resp.json()["access_token"]
    
    # Use token
    auth_resp = client.get("/api/v1/alerts/", headers={"Authorization": f"Bearer {token}"})
    assert auth_resp.status_code == 200

def test_rbac_analyst_permissions():
    resp = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "analyst123"})
    token = resp.json()["access_token"]
    
    # Try to execute investigation (Allowed for SOC_ANALYST)
    auth_resp = client.post("/api/v1/investigations/run/ALT-12345", headers={"Authorization": f"Bearer {token}"})
    # Might fail with 404/500 if alert doesn't exist, but it shouldn't be 403 Forbidden!
    assert auth_resp.status_code != 401
    assert auth_resp.status_code != 403

def test_rbac_viewer_restrictions():
    resp = client.post("/api/v1/auth/login", json={"username": "viewer", "password": "viewer123"})
    token = resp.json()["access_token"]
    
    # Try to execute investigation (Forbidden for VIEWER)
    auth_resp = client.post("/api/v1/investigations/run/ALT-12345", headers={"Authorization": f"Bearer {token}"})
    assert auth_resp.status_code == 403
    
def test_rbac_admin_user_management():
    # Analyst shouldn't access users
    resp1 = client.post("/api/v1/auth/login", json={"username": "analyst", "password": "analyst123"})
    token1 = resp1.json()["access_token"]
    assert client.get("/api/v1/users/", headers={"Authorization": f"Bearer {token1}"}).status_code == 403
    
    # Admin SHOULD access users
    resp2 = client.post("/api/v1/auth/login", json={"username": "admin", "password": "sigiladmin123"})
    token2 = resp2.json()["access_token"]
    assert client.get("/api/v1/users/", headers={"Authorization": f"Bearer {token2}"}).status_code == 200

def test_me_endpoint():
    resp = client.post("/api/v1/auth/login", json={"username": "admin", "password": "sigiladmin123"})
    token = resp.json()["access_token"]
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["role"] == "SECURITY_ADMIN"
    assert me_resp.json()["username"] == "admin"

def test_logout():
    resp = client.post("/api/v1/auth/login", json={"username": "admin", "password": "sigiladmin123"})
    token = resp.json()["access_token"]
    
    # Call logout
    out_resp = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert out_resp.status_code == 200
    # Cookie should be deleted
    assert out_resp.cookies.get("access_token") is None or out_resp.cookies.get("access_token").value == ""
