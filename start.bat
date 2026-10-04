@echo off
rem Daftari starter for Windows. Double-click to run the app.
rem First run installs everything; later runs just start the backend and frontend in their own windows.
rem Close those two windows to stop the app.
setlocal
cd /d "%~dp0"
set "PY=backend\.venv\Scripts\python.exe"
set "WAIT=%SystemRoot%\System32\timeout.exe"
set "CURL=%SystemRoot%\System32\curl.exe"

where npm >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org/ & goto :fail)

rem --- backend packages
if not exist "%PY%" (
  where python >nul 2>nul || (echo Python is not installed. Get it from https://www.python.org/downloads/ & goto :fail)
  echo Creating the Python environment...
  python -m venv backend\.venv || goto :fail
)
"%PY%" -c "import django, rest_framework_simplejwt, corsheaders, dotenv, reportlab, openpyxl" >nul 2>nul || (
  echo Installing backend packages...
  "%PY%" -m pip install -q -r backend\requirements.txt || goto :fail
)

rem --- frontend packages
if not exist frontend\node_modules\vite\package.json (
  echo Installing frontend packages...
  pushd frontend
  call npm install --no-fund --no-audit || (popd & goto :fail)
  popd
)

rem --- settings: without Docker, fall back to SQLite
if not exist backend\.env (
  copy /y backend\.env.example backend\.env >nul
  where docker >nul 2>nul || (>>backend\.env echo USE_SQLITE=1)
)
findstr /r /c:"^USE_SQLITE=1" backend\.env >nul || (
  where docker >nul 2>nul || (echo backend\.env uses PostgreSQL but Docker is not installed. Add USE_SQLITE=1 to backend\.env or install Docker. & goto :fail)
  echo Starting PostgreSQL...
  docker compose up -d || goto :fail
)

rem --- backup (SQLite only): a dated copy in BACKUP_DIR before anything touches the database
if exist backend\db.sqlite3 findstr /r /c:"^USE_SQLITE=1" backend\.env >nul && (
  echo Backing up the database...
  "%PY%" backend\manage.py backup_db >nul || echo Warning: the database could not be backed up.
)

rem --- database (retries while PostgreSQL is still booting)
echo Preparing the database...
set /a tries=0
:migrate
"%PY%" backend\manage.py migrate --noinput -v 0 && goto :seed
set /a tries+=1
if %tries% geq 10 goto :fail
ping -n 3 127.0.0.1 >nul
goto :migrate
:seed
rem Makes sure the manager login and categories exist; never touches existing data.
"%PY%" backend\manage.py seed_demo >nul || goto :fail

rem --- servers (skipped if already running)
netstat -ano | findstr /r /c:":8000 .*LISTENING" >nul || start "Daftari backend" /d backend cmd /k ".venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000"
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul || start "Daftari frontend" /d frontend cmd /k "npm run dev"

echo Waiting for the app to start...
set /a tries=0
:ready
"%CURL%" -s -o nul http://127.0.0.1:8000/api/meta/ && "%CURL%" -s -o nul http://localhost:5173/ && goto :open
set /a tries+=1
if %tries% geq 60 (echo The app did not start. Check the "Daftari backend" and "Daftari frontend" windows for errors. & goto :fail)
ping -n 2 127.0.0.1 >nul
goto :ready

:open
start "" http://localhost:5173/
echo.
echo Daftari is running at http://localhost:5173
echo Login: manager  (first-time password: daftari123, change it under Mipangilio)
echo To stop it, close the "Daftari backend" and "Daftari frontend" windows.
echo.
"%WAIT%" /t 10 2>nul
exit /b 0

:fail
echo.
echo Daftari could not start. See the message above.
pause
exit /b 1
