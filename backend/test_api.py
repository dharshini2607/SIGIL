import requests

# Check API
try:
    res = requests.post("http://127.0.0.1:8000/api/v1/auth/login", data={"username": "admin", "password": "Admin123!"})
    print("LOGIN STATUS:", res.status_code)
    token = res.json().get("access_token")
    if token:
        res2 = requests.get("http://127.0.0.1:8000/api/v1/users/eligible_analysts", headers={"Authorization": f"Bearer {token}"})
        print("API STATUS:", res2.status_code)
        print("API RESULT:", res2.json())
except Exception as e:
    print("API REQUEST FAILED:", e)
