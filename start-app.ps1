# =============================================
# Qbil Hub - Smart PowerShell Start Script
# =============================================

# Change to script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Qbil Hub - Setup Verificatie" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allChecksPass = $true

# Check 1: .env file
Write-Host "Controle 1/5: Environment configuratie..." -ForegroundColor Blue
if (-Not (Test-Path ".env")) {
    Write-Host "[X] .env bestand niet gevonden" -ForegroundColor Red
    Write-Host "    -> Zie SETUP.md voor instructies" -ForegroundColor Yellow
    $allChecksPass = $false
} else {
    Write-Host "[OK] .env bestand gevonden" -ForegroundColor Green
}

# Check 2: node_modules
Write-Host ""
Write-Host "Controle 2/5: Dependencies..." -ForegroundColor Blue
if (-Not (Test-Path "node_modules")) {
    Write-Host "[X] node_modules directory niet gevonden" -ForegroundColor Red
    Write-Host "    -> Run: npm install" -ForegroundColor Yellow
    $allChecksPass = $false
} else {
    Write-Host "[OK] node_modules directory gevonden" -ForegroundColor Green
}

# Check 3: Database
Write-Host ""
Write-Host "Controle 3/5: Database..." -ForegroundColor Blue
$dbPath = if ($env:DB_PATH) { $env:DB_PATH } else { ".\qbil_hub.db" }
if (-Not (Test-Path $dbPath)) {
    Write-Host "[X] Database bestand niet gevonden" -ForegroundColor Red
    Write-Host "    -> Run: npm run migrate" -ForegroundColor Yellow
    $allChecksPass = $false
} else {
    Write-Host "[OK] Database bestand gevonden" -ForegroundColor Green
}

# Check 4: Uploads directory
Write-Host ""
Write-Host "Controle 4/5: Upload directory..." -ForegroundColor Blue
$uploadDir = if ($env:UPLOAD_DIR) { $env:UPLOAD_DIR } else { "uploads" }
if (-Not (Test-Path $uploadDir)) {
    Write-Host "[!] Upload directory niet gevonden, aanmaken..." -ForegroundColor Yellow
    try {
        New-Item -ItemType Directory -Path $uploadDir -Force | Out-Null
        Write-Host "[OK] Upload directory aangemaakt" -ForegroundColor Green
    } catch {
        Write-Host "[X] Kon upload directory niet aanmaken" -ForegroundColor Red
        $allChecksPass = $false
    }
} else {
    Write-Host "[OK] Upload directory gevonden" -ForegroundColor Green
}

# Check 5: Logs directory
Write-Host ""
Write-Host "Controle 5/5: Logs directory..." -ForegroundColor Blue
$logsDir = if ($env:LOGS_DIR) { $env:LOGS_DIR } else { "logs" }
if (-Not (Test-Path $logsDir)) {
    Write-Host "[!] Logs directory niet gevonden, aanmaken..." -ForegroundColor Yellow
    try {
        New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
        Write-Host "[OK] Logs directory aangemaakt" -ForegroundColor Green
    } catch {
        Write-Host "[X] Kon logs directory niet aanmaken" -ForegroundColor Red
        $allChecksPass = $false
    }
} else {
    Write-Host "[OK] Logs directory gevonden" -ForegroundColor Green
}

Write-Host ""

# Show results
if (-Not $allChecksPass) {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  [!] Setup Incompleet!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Voltooi de setup met:" -ForegroundColor Yellow
    Write-Host "  1. npm install" -ForegroundColor Cyan
    Write-Host "  2. Maak .env bestand (zie SETUP.md)" -ForegroundColor Cyan
    Write-Host "  3. npm run migrate" -ForegroundColor Cyan
    Write-Host "  4. npm run seed" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Of gebruik: .\quick-start.bat" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Zie SETUP.md voor gedetailleerde instructies" -ForegroundColor Blue
    Write-Host ""
    pause
    exit 1
}

# Start server
Write-Host "========================================" -ForegroundColor Green
Write-Host "  [OK] Setup Verificatie Geslaagd!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Server starten..." -ForegroundColor Cyan
Write-Host "Druk op CTRL+C om te stoppen" -ForegroundColor Yellow
Write-Host ""

# Use nodemon in development, regular node otherwise
$isDevelopment = $env:NODE_ENV -ne "production"

if ($isDevelopment) {
    # Check if nodemon is available
    $nodemonExists = $null -ne (Get-Command nodemon -ErrorAction SilentlyContinue)
    if ($nodemonExists) {
        Write-Host "Development mode: using nodemon voor auto-reload" -ForegroundColor Blue
        Write-Host ""
        nodemon server.js
    } else {
        Write-Host "Nodemon niet gevonden, starten met normale node" -ForegroundColor Yellow
        Write-Host ""
        node server.js
    }
} else {
    node server.js
}




