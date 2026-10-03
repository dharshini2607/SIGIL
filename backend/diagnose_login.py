import requests
import subprocess
import time
import sys

print('Starting uvicorn natively...')
s = subprocess.Popen([r'venv\Scripts\python.exe', '-m', 'uvicorn', 'app.main:app', '--port', '8005'])
try:
    time.sleep(5)
    print('Testing login endpoint...')
    res = requests.post('http://localhost:8005/api/v1/auth/login', json={'username': 'analyst', 'password': 'analyst123'})
    print('Login Status:', res.status_code)
    try:
        print('Login Response:', res.json())
    except:
        print('Login Error:', res.text)
    print('Login Cookies:', res.cookies.get_dict())
    
    if res.status_code == 200:
        print('Testing /auth/me ...')
        me_res = requests.get('http://localhost:8005/api/v1/auth/me', cookies=res.cookies)
        print('Me Status:', me_res.status_code)
        try:
            print('Me Response:', me_res.json())
        except:
            print('Me Error:', me_res.text)
finally:
    s.kill()
    sys.exit(0 if res.status_code == 200 else 1)
