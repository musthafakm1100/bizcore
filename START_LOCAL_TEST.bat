@echo off
REM BizCore - local development test (Firebase Emulator). No live data, no rule publishing, no keys.
REM Uses the firestore.rules file in this folder automatically.
cd /d "%~dp0"
if not exist emulator\node_modules (
  echo First time: installing the local database tools...
  pushd emulator & call npm install & popd
)
set FIRST=0
if not exist emulator\emulator-data\firebase-export-metadata.json set FIRST=1
start "BizCore local database - keep open, press Ctrl+C here to stop and save" "%~dp0emulator\START_EMULATOR.bat"
echo Waiting for the local database to start...
:wait
powershell -NoProfile -Command "try{(New-Object Net.Sockets.TcpClient('127.0.0.1',8080)).Close();(New-Object Net.Sockets.TcpClient('127.0.0.1',9099)).Close();exit 0}catch{exit 1}"
if errorlevel 1 (timeout /t 2 /nobreak >nul & goto wait)
if "%FIRST%"=="1" (
  echo First run: adding test users and sample quotations...
  pushd emulator & node seed-local.mjs --independent --invoices --sample-orders & popd
)
start "BizCore web server - keep open" cmd /k python -m http.server 8000
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/login.html?emulator=1"
echo.
echo BizCore is open on LOCAL test data. Sign in: alice@bizcore.test / Test1234!  (admin)   bob@bizcore.test / Test1234!
echo To stop: press Ctrl+C in the "local database" window (your test data is kept for next time).
pause
