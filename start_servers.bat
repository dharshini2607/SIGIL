start cmd /c "cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
start cmd /c "cd frontend && npm run dev -- --port 5173"
