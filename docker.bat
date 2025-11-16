@echo off
REM ============================================================================
REM Docker Helper Script for Fiber Network Project (Windows)
REM ============================================================================
REM Quick commands to manage the Docker environment on Windows
REM
REM Usage: docker.bat [command]
REM ============================================================================

setlocal enabledelayedexpansion

if "%1"=="" goto :help
if "%1"=="help" goto :help
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="logs" goto :logs
if "%1"=="status" goto :status
if "%1"=="clean" goto :clean
if "%1"=="reset" goto :reset
if "%1"=="build" goto :build
if "%1"=="db" goto :db
if "%1"=="backend" goto :backend
if "%1"=="frontend" goto :frontend
if "%1"=="test" goto :test
if "%1"=="backup" goto :backup

echo Unknown command: %1
goto :help

:start
echo Starting all services...
docker-compose up -d
echo.
echo ✅ All services started!
echo Frontend: http://localhost:8080
echo Backend: http://localhost:5001
echo Database: localhost:5432
goto :end

:stop
echo Stopping all services...
docker-compose stop
echo ✅ All services stopped!
goto :end

:restart
echo Restarting all services...
docker-compose restart
echo ✅ All services restarted!
goto :end

:logs
echo Showing logs (Ctrl+C to exit)...
if "%2"=="" (
    docker-compose logs -f
) else (
    docker-compose logs -f %2
)
goto :end

:status
echo Service status:
docker-compose ps
goto :end

:clean
echo ⚠️  This will stop and remove all containers
set /p confirm="Are you sure? (y/N): "
if /i "%confirm%"=="y" (
    docker-compose down
    echo ✅ Containers removed!
) else (
    echo Cancelled
)
goto :end

:reset
echo ⚠️  WARNING: This will DELETE ALL DATA including the database!
set /p confirm="Are you ABSOLUTELY sure? (y/N): "
if /i "%confirm%"=="y" (
    docker-compose down -v
    echo ✅ Complete reset done!
) else (
    echo Cancelled
)
goto :end

:build
echo Rebuilding all images...
docker-compose build --no-cache
echo ✅ All images rebuilt!
goto :end

:db
echo Connecting to database...
docker-compose exec db psql -U postgres -d fiber_network
goto :end

:backend
echo Opening backend shell...
docker-compose exec backend sh
goto :end

:frontend
echo Opening frontend shell...
docker-compose exec frontend sh
goto :end

:test
echo Running backend tests...
docker-compose exec backend npm test
goto :end

:backup
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set mytime=%mytime: =0%
set BACKUP_FILE=backup_%mydate%_%mytime%.sql
echo Creating backup: %BACKUP_FILE%
docker-compose exec -T db pg_dump -U postgres fiber_network > %BACKUP_FILE%
echo ✅ Backup created: %BACKUP_FILE%
goto :end

:help
echo Fiber Network Docker Helper (Windows)
echo.
echo Usage: docker.bat [command]
echo.
echo Commands:
echo   start       Start all services
echo   stop        Stop all services
echo   restart     Restart all services
echo   logs        Show logs from all services
echo   status      Show status of all containers
echo   clean       Stop and remove containers (keeps data)
echo   reset       Complete reset - DELETES ALL DATA
echo   build       Rebuild all images
echo   db          Connect to PostgreSQL database
echo   backend     Open backend container shell
echo   frontend    Open frontend container shell
echo   test        Run backend tests
echo   backup      Create database backup
echo   help        Show this help message
echo.
echo Examples:
echo   docker.bat start
echo   docker.bat logs backend
echo   docker.bat db
goto :end

:end
endlocal
