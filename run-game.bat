@echo off
setlocal
set "WEB_DIR=%~dp0web"

if not exist "%WEB_DIR%\" (
  echo Expected web app folder at: %WEB_DIR% 1>&2
  exit /b 1
)

cd /d "%WEB_DIR%"

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting game dev server...
echo Then open: http://localhost:5173/
echo.

call npm run dev -- --host
