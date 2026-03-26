@echo off
echo Iniciando SIGGAN...

:: Base de datos (Backend - npm run dev incluye Prisma)
start "SIGGAN Backend" cmd /k "cd /d "%~dp0Backend" && npm run dev"

:: Servicio de iris (Python 3.12)
start "SIGGAN Iris Service" cmd /k "cd /d "%~dp0Backend" && py -3.12 iris_service.py"

:: Frontend
start "SIGGAN Frontend" cmd /k "cd /d "%~dp0Frontend\siggan-web" && npm start"

echo.
echo Servicios iniciados:
echo  - Backend (Node):   http://localhost:3001
echo  - Iris Service:     http://localhost:5000
echo  - Frontend:         http://localhost:3000
echo.
pause
