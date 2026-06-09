@echo off
echo =======================================================
echo Starting GRIP Project (Frontend + AI Backend + Gov Dashboard)
echo =======================================================

echo Starting FastAPI Backend API in a new window...
start "GRIP Backend API" cmd /k "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo Starting React Mobile Frontend in a new window...
start "GRIP Mobile Frontend" cmd /k "cd grip && npm run dev"

echo Starting Government Command Center (Next.js) in a new window...
start "GRIP Gov Dashboard" cmd /k "cd grip-dashboard && npm run dev -- -p 3001"
echo Starting Background Telemetry Worker in a new window...
start "GRIP Telemetry Worker" cmd /k "cd backend && python worker.py"

echo.
echo All 4 servers have been started in separate windows!
echo You can close this window now.
echo =======================================================
pause
