@echo off
title Asystent Pakowania - aledeska.pl
cd /d "%~dp0"

echo Uruchamianie aplikacji...

:: sprawdz czy Python jest dostepny
python --version >nul 2>&1
if errorlevel 1 (
    echo Python nie znaleziony. Probuje python3...
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo.
        echo BLAD: Python nie jest zainstalowany.
        echo Pobierz z: https://www.python.org/downloads/
        pause
        exit /b 1
    )
    set PY=python3
) else (
    set PY=python
)

:: znajdz wolny port
set PORT=8742

:: uruchom serwer HTTP w tle
start "" /b %PY% -m http.server %PORT% --bind 127.0.0.1

:: czekaj chwile az serwer wstanie
timeout /t 1 /nobreak >nul

:: otworz przegldarke
start "" "http://127.0.0.1:%PORT%/index.html"

echo.
echo Aplikacja otwarta w przegladarce.
echo Adres: http://127.0.0.1:%PORT%/index.html
echo.
echo To okno mozesz zminimalizowac - nie zamykaj go.
echo Zamknij to okno aby wylaczyc serwer.
echo.
pause

:: po zamknieciu okna zatrzymaj serwer
for /f "tokens=5" %%a in ('netstat -aon ^| find ":%PORT%"') do (
    taskkill /f /pid %%a >nul 2>&1
)
