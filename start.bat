@echo off
cd /d "%~dp0"
echo Starting Best Homes CRM at http://localhost:4310
echo Close this window to stop it.
start "" http://localhost:4310
node --disable-warning=ExperimentalWarning server.js
pause
