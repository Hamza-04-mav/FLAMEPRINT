# FLAMEPRINT one-command launcher (Windows PowerShell)
#   .\start.ps1            -> installs dependencies on first run, then starts the API (:8000) and the web app (:3000)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- backend
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "Creating Python venv + installing backend deps..." -ForegroundColor Cyan
    python -m venv (Join-Path $root "backend\.venv")
    & $py -m pip install -q -r (Join-Path $root "backend\requirements.txt")
}
if (-not (Test-Path (Join-Path $root "backend\.env"))) {
    Copy-Item (Join-Path $root "backend\.env.example") (Join-Path $root "backend\.env")
}

# --- frontend
if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
    Write-Host "Installing frontend deps..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "frontend"); npm install; Pop-Location
}

Write-Host "Starting FLAMEPRINT API on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$api = Start-Process -FilePath $py -ArgumentList "-m", "uvicorn", "app.main:app", "--port", "8000", "--reload" `
    -WorkingDirectory (Join-Path $root "backend") -PassThru -NoNewWindow

try {
    Write-Host "Starting web app on http://localhost:3000 ..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "frontend")
    npm run dev
} finally {
    Pop-Location
    if ($api -and -not $api.HasExited) { Stop-Process -Id $api.Id -Force }
}
