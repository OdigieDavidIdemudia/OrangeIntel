@echo off
echo Starting OrangeIntel Application...

:: Start Backend
echo Starting Backend...
start "OrangeIntel Backend" cmd /k "cd backend\OrangeIntel.Api && dotnet run"

:: Start Frontend
echo Starting Frontend...
start "OrangeIntel Frontend" cmd /k "cd frontend && npm run dev"

echo Application services are starting in separate windows.
