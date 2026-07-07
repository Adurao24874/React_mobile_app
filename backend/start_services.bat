@echo off
echo Starting GRIP Backend Services...

:: Start the FastAPI backend API in a new window
echo Starting FastAPI Main Server (main.py) on port 8000...
start "GRIP API" cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: Start the Background Telemetry Worker in a new window
echo Starting Background Telemetry Worker (worker.py)...
start "GRIP Worker" cmd /c "python worker.py"

echo Services have been launched in separate windows!
