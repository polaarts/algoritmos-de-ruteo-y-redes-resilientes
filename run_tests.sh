#!/bin/bash

# Script de pruebas automatizadas del sistema
# Fecha: 10 de noviembre de 2025

set -e

echo "🧪 INICIANDO PRUEBAS DEL SISTEMA"
echo "================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0

# Función para pruebas
test_case() {
    local name="$1"
    local command="$2"
    
    echo -n "  Testing: $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
        return 1
    fi
}

## PRUEBAS DE BASE DE DATOS
echo -e "${BLUE}[1/5] Pruebas de Base de Datos${NC}"
echo "--------------------------------"

test_case "PostgreSQL está corriendo" \
    "sudo docker-compose exec -T db pg_isready -U postgres"

test_case "Tabla edges existe y tiene datos" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM edges' | grep -q '59916'"

test_case "Tabla earthquakes tiene datos" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM earthquakes' | grep -q '30'"

test_case "edge_failure_probabilities poblada" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM edge_failure_probabilities' | grep -q '[0-9]\+'"

test_case "Topología pgRouting creada" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c 'SELECT COUNT(*) FROM edges_vertices_pgr' | grep -q '9918'"

echo ""

## PRUEBAS DE FUNCIONES SQL
echo -e "${BLUE}[2/5] Pruebas de Funciones SQL${NC}"
echo "-------------------------------"

test_case "Función calculate_resilient_path existe" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c '\df calculate_resilient_path' | grep -q 'calculate_resilient_path'"

test_case "Función calculate_edge_probabilities existe" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c '\df calculate_edge_probabilities' | grep -q 'calculate_edge_probabilities'"

test_case "pgr_dijkstra funciona (routing básico)" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c \"SELECT COUNT(*) FROM pgr_dijkstra('SELECT id, source, target, cost, reverse_cost FROM edges', 5804, 808, false)\" | grep -q '[0-9]\+'"

test_case "Componentes conectados detectados" \
    "sudo docker-compose exec -T db psql -U postgres -d postgres -c \"SELECT COUNT(DISTINCT component) FROM pgr_connectedComponents('SELECT id, source, target, cost FROM edges')\" | grep -q '[0-9]\+'"

echo ""

## PRUEBAS DE PYTHON
echo -e "${BLUE}[3/5] Pruebas de Python${NC}"
echo "-----------------------"

test_case "Entorno virtual Python existe" \
    "[ -d '.venv' ]"

test_case "psycopg2 instalado" \
    "source .venv/bin/activate && python -c 'import psycopg2' 2>/dev/null"

test_case "numpy instalado" \
    "source .venv/bin/activate && python -c 'import numpy' 2>/dev/null"

test_case "networkx instalado" \
    "source .venv/bin/activate && python -c 'import networkx' 2>/dev/null"

test_case "mip instalado (optimización)" \
    "source .venv/bin/activate && python -c 'import mip' 2>/dev/null"

test_case "deap instalado (algoritmos genéticos)" \
    "source .venv/bin/activate && python -c 'import deap' 2>/dev/null"

echo ""

## PRUEBAS DE BACKEND
echo -e "${BLUE}[4/5] Pruebas de Backend Node.js${NC}"
echo "---------------------------------"

test_case "Dependencias npm instaladas" \
    "[ -d 'backend/node_modules' ]"

test_case "Archivo server.js existe" \
    "[ -f 'backend/server.js' ]"

test_case "routes/infrastructure.js existe" \
    "[ -f 'backend/routes/infrastructure.js' ]"

test_case "routes/routing.js existe" \
    "[ -f 'backend/routes/routing.js' ]"

test_case "routes/simulation.js existe" \
    "[ -f 'backend/routes/simulation.js' ]"

test_case "routes/optimization.js existe" \
    "[ -f 'backend/routes/optimization.js' ]"

test_case "config/database.js existe" \
    "[ -f 'backend/config/database.js' ]"

echo ""

## PRUEBAS DE SCRIPTS
echo -e "${BLUE}[5/5] Pruebas de Scripts${NC}"
echo "------------------------"

test_case "quick_load_data.py existe" \
    "[ -f 'scripts/quick_load_data.py' ]"

test_case "calc_prob_batch.py existe" \
    "[ -f 'scripts/calc_prob_batch.py' ]"

test_case "mip_optimizer.py existe" \
    "[ -f 'scripts/mip_optimizer.py' ]"

test_case "genetic_algorithm.py existe" \
    "[ -f 'scripts/genetic_algorithm.py' ]"

echo ""
echo "================================="
echo -e "${GREEN}✓ PASSED: $PASSED${NC}"
echo -e "${RED}✗ FAILED: $FAILED${NC}"
echo "================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 TODAS LAS PRUEBAS PASARON!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Algunas pruebas fallaron. Revisar reporte.${NC}"
    exit 1
fi
