@echo off
echo ================================================
echo VERIFICACION RAPIDA DE OSRM
echo ================================================
echo.

echo [1/5] Verificando contenedor OSRM...
docker-compose ps osrm | findstr "Up"
if errorlevel 1 (
    echo   [X] OSRM no esta corriendo
    echo   Solucion: docker-compose up -d osrm
    echo.
    goto :error
) else (
    echo   [OK] OSRM esta corriendo
    echo.
)

echo [2/5] Verificando servicio OSRM en puerto 5001...
curl -s http://localhost:5001/ > nul
if errorlevel 1 (
    echo   [X] OSRM no responde
    echo   Solucion: docker-compose restart osrm
    echo.
    goto :error
) else (
    echo   [OK] OSRM responde correctamente
    echo.
)

echo [3/5] Verificando API backend...
curl -s http://localhost:5000/api/osrm/health > nul
if errorlevel 1 (
    echo   [X] API backend no responde
    echo   Solucion: docker-compose restart backend
    echo.
    goto :error
) else (
    echo   [OK] API backend funciona
    echo.
)

echo [4/5] Contando enlaces OSRM en base de datos...
for /f "tokens=*" %%a in ('docker-compose exec -T db psql -U postgres -d fiber_network -t -c "SELECT COUNT(*) FROM fiber_links WHERE created_with_osrm = true;"') do set COUNT=%%a
echo   Enlaces OSRM encontrados: %COUNT%
if "%COUNT%"=="0" (
    echo   [!] No hay enlaces OSRM todavia
    echo   Solucion: node scripts/generate-biobio-fiber-links.js
    echo.
) else (
    echo   [OK] Enlaces OSRM presentes
    echo.
)

echo [5/5] Probando ruta de ejemplo (Concepcion - Los Alamos)...
curl -s "http://localhost:5000/api/osrm/route?start=-73.0444,-36.8201&end=-73.4118,-37.6272" > temp_route.json
findstr "distance" temp_route.json > nul
if errorlevel 1 (
    echo   [X] Error obteniendo ruta
    del temp_route.json > nul 2>&1
    goto :error
) else (
    echo   [OK] Ruta obtenida exitosamente
    del temp_route.json > nul 2>&1
    echo.
)

echo ================================================
echo TODAS LAS VERIFICACIONES PASARON!
echo ================================================
echo.
echo Sistema OSRM funcionando correctamente
echo.
echo Puedes usar:
echo   - API: http://localhost:5000/api/osrm/route
echo   - Frontend: http://localhost:8080
echo   - Documentacion: docs/OSRM.md
echo.
pause
exit /b 0

:error
echo ================================================
echo VERIFICACION FALLIDA
echo ================================================
echo.
echo Revisa los errores anteriores y ejecuta las soluciones sugeridas
echo.
echo Comandos utiles:
echo   docker-compose ps                    - Ver estado de contenedores
echo   docker-compose logs osrm             - Ver logs de OSRM
echo   docker-compose restart osrm          - Reiniciar OSRM
echo   docs/OSRM.md                         - Documentacion completa
echo.
pause
exit /b 1
