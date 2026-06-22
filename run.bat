@echo off
echo Starting BigQuery Release Notes Hub...
if not exist .venv (
    echo Creating virtual environment and installing dependencies...
    uv venv --python 3.11
    uv pip install Flask requests
)
echo Application is launching on http://127.0.0.1:5000
uv run app.py
pause
