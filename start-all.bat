@echo off
echo Iniciando SIGGAN...

:: Liberar puertos si ya estaban ocupados
echo Liberando puertos...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul

:: =========================
:: Backend (Node + Prisma)
:: =========================
start "SIGGAN Backend" cmd /k "cd /d "%~dp0Backend" && npm run dev"

:: =========================
:: Servicio de iris (Python 3.12)
:: =========================
start "SIGGAN Iris Service" cmd /k "cd /d "%~dp0Backend" && py -3.12 iris_service.py"

:: =========================
:: Frontend
:: =========================
start "SIGGAN Frontend" cmd /k "cd /d "%~dp0Frontend\siggan-web" && npm start"

:: =========================
:: Simulador IoT
:: =========================
start "SIGGAN IoT Simulator" cmd /k "cd /d "%~dp0para sensores fisicos" && npm start"

echo.
echo Servicios iniciados:
echo  - Backend (Node):   http://localhost:3001
echo  - Iris Service:     http://localhost:5000
echo  - Frontend:         http://localhost:3000
echo  - IoT Simulator:    ejecutandose en consola
echo.
pause