from fastapi.testclient import TestClient
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.main import app

client = TestClient(app)

def test_read_main():
    response = client.get("/api/v1/alerts/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
