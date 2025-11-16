@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM Script de Inicio - Red de Fibra Optica Chile
REM =============================================================================
REM Este script te guia para levantar el proyecto completo
REM
REM Requisitos:
REM - Docker Desktop instalado y corriendo
REM =============================================================================

chcp 65001 >nul
cls

REM Banner
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║   🌐 Red de Fibra Óptica - Resiliencia en Chile              ║
echo ║                                                                ║
echo ║   Script de Inicio Rápido                                     ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM =============================================================================
REM PASO 1: Verificar requisitos
REM =============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ▶ Paso 1: Verificando requisitos del sistema
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

set "requirements_met=1"

REM Verificar Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [✗] Docker no encontrado
    echo     ^→ Instala Docker Desktop: https://www.docker.com/products/docker-desktop
    set "requirements_met=0"
) else (
    echo [✓] Docker instalado
)

REM Verificar Docker Compose
docker compose version >nul 2>&1
if errorlevel 1 (
    echo [✗] Docker Compose no encontrado
    set "requirements_met=0"
) else (
    echo [✓] Docker Compose instalado
)

REM Verificar que Docker esté corriendo
docker ps >nul 2>&1
if errorlevel 1 (
    echo [✗] Docker no está corriendo
    echo     ^→ Inicia Docker Desktop y vuelve a ejecutar este script
    goto :error_exit
) else (
    echo [✓] Docker está corriendo
)

if "%requirements_met%"=="0" (
    echo.
    echo [❌] Faltan requisitos. Por favor instálalos y vuelve a ejecutar este script.
    goto :error_exit
)

echo.
echo [✅] Todos los requisitos están listos
echo.
timeout /t 2 /nobreak >nul

REM =============================================================================
REM PASO 2: Verificar archivo .env
REM =============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ▶ Paso 2: Configuración de variables de entorno
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

if not exist ".env" (
    echo [⚠] Archivo .env no encontrado
    echo.
    
    if exist ".env.docker.example" (
        echo Se creará un archivo .env desde .env.docker.example
        echo.
        
        set /p "create_env=¿Deseas crear el archivo .env ahora? (s/n): "
        if /i "!create_env!"=="s" (
            copy ".env.docker.example" ".env" >nul
            echo [✓] Archivo .env creado
            echo.
            echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            echo [ℹ] La base de datos se ejecuta en un contenedor Docker
            echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            echo.
            echo El archivo .env ya viene configurado con los valores por defecto
            echo para la base de datos PostgreSQL local en Docker:
            echo.
            echo    - DB_HOST=db
            echo    - DB_PORT=5432
            echo    - DB_NAME=fiber_network
            echo    - DB_USER=postgres
            echo    - DB_PASSWORD=postgres
            echo.
            echo [✓] No necesitas configurar nada más
        ) else (
            echo.
            echo No se puede continuar sin archivo .env
            goto :normal_exit
        )
    ) else (
        echo [✗] No se encontró .env.docker.example
        goto :error_exit
    )
) else (
    echo [✓] Archivo .env encontrado
)

echo.
timeout /t 2 /nobreak >nul

REM =============================================================================
REM PASO 3: Levantar servicios con Docker
REM =============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ▶ Paso 3: Levantando servicios con Docker
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Se levantarán los siguientes servicios:
echo.
echo   • Database (PostgreSQL + PostGIS) → localhost:5432
echo   • Backend  (Node.js + Express)    → http://localhost:3000
echo   • Frontend (React + Vite)         → http://localhost:5173
echo.

set /p "start_services=¿Deseas levantar los servicios ahora? (s/n): "
if /i "!start_services!"=="s" (
    echo.
    echo [🐳] Iniciando Docker Compose...
    echo.
    
    docker compose up -d
    
    echo.
    echo [✅] Servicios levantados exitosamente
    echo.
    
    REM Esperar un momento para que los servicios inicien
    echo Esperando a que los servicios inicien...
    echo (La base de datos puede tardar ~10 segundos en estar lista)
    timeout /t 10 /nobreak >nul
    
    REM Verificar estado de servicios
    echo.
    echo [📊] Estado de los servicios:
    echo.
    docker compose ps
    
) else (
    echo.
    echo Puedes levantar los servicios manualmente con:
    echo   docker compose up -d
    goto :normal_exit
)

echo.
timeout /t 2 /nobreak >nul

REM =============================================================================
REM PASO 4: Verificar servicios
REM =============================================================================
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ▶ Paso 4: Verificando servicios
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

echo Verificando que los servicios respondan...
echo.

REM Verificar Database
echo Database (PostgreSQL)... 
docker compose exec -T db pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo [⚠] No responde aún
) else (
    echo [✓] Conectado
)

REM Verificar Backend
echo Backend (http://localhost:3000)... 
curl -s -o nul -w "%%{http_code}" http://localhost:3000/api/health 2>nul | findstr "200" >nul 2>&1
if errorlevel 1 (
    echo [⚠] No responde aún (puede tardar unos segundos)
) else (
    echo [✓] Respondiendo
)

REM Verificar Frontend
echo Frontend (http://localhost:5173)... 
curl -s -o nul http://localhost:5173 2>nul
if errorlevel 1 (
    echo [⚠] No responde aún (puede tardar unos segundos)
) else (
    echo [✓] Respondiendo
)

echo.

REM =============================================================================
REM FINALIZACIÓN
REM =============================================================================
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║   🎉 ¡Proyecto levantado exitosamente!                        ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo [📍] URLs de acceso:
echo.
echo    🌐 Frontend:  http://localhost:5173
echo    🔧 Backend:   http://localhost:3000
echo    🗄️  Database:  localhost:5432 (postgres/postgres)
echo.
echo [📚] Comandos útiles:
echo.
echo    Ver logs:              docker compose logs -f
echo    Ver logs del backend:  docker compose logs -f backend
echo    Ver logs de la BD:     docker compose logs -f db
echo    Conectar a la BD:      docker compose exec db psql -U postgres fiber_network
echo    Reiniciar servicios:   docker compose restart
echo    Detener servicios:     docker compose down
echo.
echo [📖] Documentación:
echo.
echo    Inicio rápido:    docs\QUICKSTART.md
echo    Desarrollo:       docs\development\LOCAL_DEVELOPMENT.md
echo    Troubleshooting:  docs\troubleshooting\
echo.
echo [✅] ¡Disfruta explorando el proyecto! 🚀
echo.

goto :normal_exit

:error_exit
echo.
echo [❌] El script terminó con errores
pause
exit /b 1

:normal_exit
pause
exit /b 0
