@echo off
REM =============================================
REM Qbil Hub - Quick Start Script (Windows)
REM =============================================

setlocal enabledelayedexpansion

echo ========================================
echo   Qbil Hub - Quick Start Setup
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Node.js is niet geinstalleerd!
    echo Installeer Node.js 18+ van https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% gevonden

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] npm is niet geinstalleerd!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [OK] npm %NPM_VERSION% gevonden
echo.

REM Step 1: Install dependencies
echo Stap 1/5: Dependencies installeren...
echo ----------------------------------------
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [X] Fout bij installeren dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies geinstalleerd
echo.

REM Step 2: Create .env file if it doesn't exist
echo Stap 2/5: Environment configuratie...
echo ----------------------------------------
if not exist .env (
    echo Geen .env bestand gevonden. Aanmaken...
    (
        echo # Server Configuration
        echo PORT=3000
        echo NODE_ENV=development
        echo.
        echo # CORS
        echo CORS_ORIGIN=http://localhost:3000
        echo.
        echo # JWT
        echo JWT_SECRET=ontwikkel-geheim-verander-dit-in-productie-gebruik-minimaal-32-karakters
        echo JWT_EXPIRES_IN=24h
        echo JWT_REFRESH_EXPIRES_IN=7d
        echo.
        echo # Database
        echo DB_PATH=./qbil_hub.db
        echo.
        echo # File Uploads
        echo UPLOAD_DIR=uploads
        echo MAX_FILE_SIZE=10485760
        echo.
        echo # Logging
        echo LOG_LEVEL=info
        echo LOGS_DIR=logs
        echo.
        echo # Cleanup
        echo DOCUMENT_RETENTION_DAYS=90
        echo AUDIT_LOG_RETENTION_DAYS=180
        echo TIMEZONE=Europe/Amsterdam
    ) > .env
    echo [OK] .env bestand aangemaakt
) else (
    echo [!] .env bestand bestaat al, overslaan...
)
echo.

REM Step 3: Setup database
echo Stap 3/5: Database initialiseren...
echo ----------------------------------------
call npm run migrate
if %ERRORLEVEL% NEQ 0 (
    echo [X] Fout bij database migraties
    pause
    exit /b 1
)
echo [OK] Database migraties voltooid
echo.

REM Step 4: Seed demo data
echo Stap 4/5: Demo data toevoegen...
echo ----------------------------------------
call npm run seed
if %ERRORLEVEL% NEQ 0 (
    echo [X] Fout bij toevoegen demo data
    pause
    exit /b 1
)
echo [OK] Demo data toegevoegd
echo.

REM Step 5: All done
echo ========================================
echo [OK] Setup succesvol voltooid!
echo ========================================
echo.
echo Demo Login Credentials:
echo    Email:    admin@companya.com
echo    Password: admin123
echo.
echo Start de server met:
echo    npm run dev
echo.
echo Open daarna in je browser:
echo    http://localhost:3000/login.html
echo.
echo Voor meer informatie, zie SETUP.md
echo.

REM Ask if user wants to start the server now
set /p START_SERVER="Wil je de server nu starten? (y/n): "
if /i "%START_SERVER%"=="y" (
    echo.
    echo Server starten...
    echo Druk op CTRL+C om te stoppen
    echo.
    timeout /t 2 /nobreak >nul
    call npm run dev
)

pause

