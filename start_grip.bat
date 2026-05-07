@echo off
echo =======================================================
echo Starting GRIP Project (Frontend + AI Backend + Worker + Gov Dashboard + n8n)
echo =======================================================

echo Starting FastAPI Backend API in a new window...
start "GRIP Backend API" cmd /k "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting Python AI Worker in a new window...
start "GRIP AI Worker" cmd /k "cd backend && python -u worker.py"

echo Starting React Mobile Frontend in a new window...
start "GRIP Mobile Frontend" cmd /k "cd grip && npm run dev"

echo Starting Government Command Center (Next.js) in a new window...
start "GRIP Gov Dashboard" cmd /k "cd grip-dashboard && npm run dev -- -p 3001"

echo Starting n8n Automation Engine in a new window...
start "GRIP n8n" cmd /k "npx n8n start"

echo.
echo All 5 servers have been started in separate windows!
echo You can close this window now.
echo =======================================================
pause
