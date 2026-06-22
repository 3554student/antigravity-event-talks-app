# Write-Host "Starting BigQuery Release Notes Hub..." -ForegroundColor Cyan
if (!(Test-Path .venv)) {
    Write-Host "Creating virtual environment and installing dependencies..." -ForegroundColor Yellow
    uv venv --python 3.11
    uv pip install Flask requests
}
Write-Host "Application is launching on http://127.0.0.1:5000" -ForegroundColor Green
uv run app.py
