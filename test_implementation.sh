#!/bin/bash

# Script de prueba para verificar implementación completa
# Ejecutar desde la raíz del proyecto

echo "============================================"
echo "  PRUEBA DE IMPLEMENTACIÓN COMPLETA"
echo "============================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar respuesta HTTP
check_endpoint() {
    local name=$1
    local url=$2
    local method=$3
    local data=$4
    
    echo -n "Probando $name... "
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    fi
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response)"
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
    fi
}

# Verificar que el backend esté corriendo
echo "1. Verificando backend..."
check_endpoint "Health Check" "http://localhost:5001/health" "GET"
echo ""

# Verificar endpoints de routing
echo "2. Verificando endpoints de ruteo..."
check_endpoint "Routing Info" "http://localhost:5001/api/routing" "GET"

# Datos de prueba: Santiago -> Valparaíso
test_data='{
  "start_lat": -33.4489,
  "start_lon": -70.6693,
  "end_lat": -33.0369,
  "end_lon": -71.6277
}'

check_endpoint "Dijkstra Simple" "http://localhost:5001/api/routing/calculate" "POST" "$test_data"

check_endpoint "Dijkstra Ponderado" "http://localhost:5001/api/routing/calculate-resilient" "POST" "$test_data"

# MIP
mip_data='{
  "start_lat": -33.4489,
  "start_lon": -70.6693,
  "end_lat": -33.0369,
  "end_lon": -71.6277,
  "riskWeight": 0.5,
  "distanceWeight": 0.5
}'
check_endpoint "MIP Optimization" "http://localhost:5001/api/routing/mip" "POST" "$mip_data"

check_endpoint "MIP Model Info" "http://localhost:5001/api/routing/mip/model-info" "GET"

# Algoritmo Genético
genetic_data='{
  "start_lat": -33.4489,
  "start_lon": -70.6693,
  "end_lat": -33.0369,
  "end_lon": -71.6277,
  "populationSize": 30,
  "generations": 50,
  "mutationRate": 0.15
}'
check_endpoint "Algoritmo Genético" "http://localhost:5001/api/routing/genetic" "POST" "$genetic_data"

echo ""

# Verificar endpoints de simulación
echo "3. Verificando simulación de fallas..."

sim_data='{"simulationName": "Test Simulation"}'
check_endpoint "Trigger Failures" "http://localhost:5001/api/simulation/trigger-failures" "POST" "$sim_data"

check_endpoint "Network Status" "http://localhost:5001/api/simulation/network-status" "GET"

check_endpoint "Clear Failures" "http://localhost:5001/api/simulation/clear-failures" "POST" "{}"

echo ""

# Verificar endpoints de probabilidades
echo "4. Verificando probabilidades..."
check_endpoint "Node Probabilities" "http://localhost:5001/api/probabilities/nodes?limit=5" "GET"
check_endpoint "Edge Probabilities" "http://localhost:5001/api/probabilities/edges?limit=5" "GET"
check_endpoint "Statistics" "http://localhost:5001/api/probabilities/statistics" "GET"

echo ""

# Verificar amenazas
echo "5. Verificando amenazas..."
check_endpoint "Earthquakes" "http://localhost:5001/api/threats/earthquakes?limit=5" "GET"
check_endpoint "Fire Zones" "http://localhost:5001/api/threats/fire-zones?limit=5" "GET"
check_endpoint "Weather Events" "http://localhost:5001/api/threats/weather-events?limit=5" "GET"

echo ""

# Verificar infraestructura
echo "6. Verificando infraestructura..."
check_endpoint "Datacenters" "http://localhost:5001/api/infrastructure/datacenters?limit=5" "GET"
check_endpoint "Nodes" "http://localhost:5001/api/infrastructure/nodes?limit=5" "GET"
check_endpoint "Links" "http://localhost:5001/api/infrastructure/links?limit=5" "GET"

echo ""
echo "============================================"
echo "  PRUEBA COMPLETADA"
echo "============================================"
echo ""

# Verificar archivos críticos
echo "7. Verificando archivos críticos..."
echo ""

files=(
    "backend/routes/simulation-v2.js"
    "backend/algorithms/genetic_routing.js"
    "backend/algorithms/mip_routing.js"
    "frontend/src/components/SimulationControlsV2.jsx"
    "docs/CASO_EJEMPLO.md"
    "IMPLEMENTACION_RESUMEN.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        echo -e "${GREEN}✓${NC} $file (${lines} líneas)"
    else
        echo -e "${RED}✗${NC} $file (NO EXISTE)"
    fi
done

echo ""
echo "============================================"
echo "  RESUMEN"
echo "============================================"
echo ""
echo "Archivos verificados: ${#files[@]}"
echo ""
echo "Para probar manualmente:"
echo "  1. Frontend: http://localhost:5173"
echo "  2. Backend:  http://localhost:5001"
echo "  3. Docs:     cat docs/CASO_EJEMPLO.md"
echo ""
echo -e "${YELLOW}Nota:${NC} Algunos endpoints pueden tomar varios segundos"
echo "      (especialmente algoritmo genético)"
echo ""
