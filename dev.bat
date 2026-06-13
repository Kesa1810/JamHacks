@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"

echo.
echo  Stopping anything on port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
  taskkill /F /PID %%a >nul 2>&1
)

echo  Starting SaberSync...
echo.
npm run dev
