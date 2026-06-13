@echo off
:: Allow phone connections to the dev server (run as Administrator)
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting admin rights...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="SaberSync Dev Server" >nul 2>&1
netsh advfirewall firewall add rule name="SaberSync Dev Server" dir=in action=allow protocol=TCP localport=5173

echo.
echo Firewall rule added for port 5173.
echo Phones on the same network can now reach the dev server.
echo.
pause
