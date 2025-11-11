#!/bin/bash

# Script de Verificación del Proyecto T3 Grupal
# Verifica que todos los archivos críticos estén presentes

echo "🔍 Verificando Proyecto - T3 Grupal"
echo "======================================"
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador
TOTAL=0
PASSED=0

# Función para verificar archivo
check_file() {
    local file=$1
    local description=$2
    TOTAL=$((TOTAL + 1))

    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo -e "  └─ $file"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $description"
        echo -e "  └─ ${RED}FALTANTE:${NC} $file"
    fi
}

# Función para verificar directorio
check_dir() {
    local dir=$1
    local description=$2
    TOTAL=$((TOTAL + 1))

    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $description"
        echo -e "  └─ $dir/"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗${NC} $description"
        echo -e "  └─ ${RED}FALTANTE:${NC} $dir/"
    fi
}

echo "📂 ESTRUCTURA DEL PROYECTO"
echo "─────────────────────────────"
check_dir "frontend" "Directorio Frontend"
check_dir "backend" "Directorio Backend"
check_dir "scripts" "Directorio Scripts"
check_dir "migrations" "Directorio Migrations"
echo ""

echo "⚛️  FRONTEND - COMPONENTES REACT"
echo "─────────────────────────────"
check_file "frontend/src/components/RouteComparison.jsx" "RouteComparison - Comparación 4 Algoritmos ⭐"
check_file "frontend/src/components/SimulationControls.jsx" "SimulationControls - Simulación Monte Carlo ⭐"
check_file "frontend/src/components/RouteCalculator.jsx" "RouteCalculator - Con GPS"
check_file "frontend/src/components/ThreatsLayer.jsx" "ThreatsLayer - Popups mejorados"
check_file "frontend/src/components/InfrastructureLayer.jsx" "InfrastructureLayer"
check_file "frontend/src/components/Map.jsx" "Map - Componente Leaflet"
echo ""

echo "🎨 FRONTEND - ESTILOS CSS"
echo "─────────────────────────────"
check_file "frontend/src/styles/RouteComparison.css" "Estilos RouteComparison ⭐"
check_file "frontend/src/styles/SimulationControls.css" "Estilos SimulationControls ⭐"
check_file "frontend/src/styles/App.css" "Estilos App (modificado)"
check_file "frontend/src/styles/index.css" "Estilos Index"
echo ""

echo "🔌 FRONTEND - SERVICIOS"
echo "─────────────────────────────"
check_file "frontend/src/services/api.js" "API Services (ampliado) ⭐"
check_file "frontend/src/App.jsx" "App.jsx (modificado)"
check_file "frontend/src/main.jsx" "Main.jsx"
check_file "frontend/index.html" "Index HTML"
check_file "frontend/package.json" "Package.json"
check_file "frontend/vite.config.js" "Vite Config"
echo ""

echo "🚀 BACKEND - RUTAS API"
echo "─────────────────────────────"
check_file "backend/server.js" "Server Principal"
check_file "backend/routes/routing.js" "Routing API"
check_file "backend/routes/optimization.js" "Optimization API (MIP + GA)"
check_file "backend/routes/simulation.js" "Simulation API"
check_file "backend/routes/probabilities.js" "Probabilities API"
check_file "backend/routes/threats.js" "Threats API"
check_file "backend/routes/metadata.js" "Metadata API"
check_file "backend/routes/infrastructure.js" "Infrastructure API"
check_file "backend/config/database.js" "Database Config"
echo ""

echo "🗄️  BASE DE DATOS"
echo "─────────────────────────────"
check_file "schema.sql" "Schema Principal"
check_file "create-topology.sql" "Script Topología"
check_file "functions/resilient_routing.sql" "Funciones pgRouting"
check_file "migrations/004_add_probabilities.sql" "Migration Probabilidades"
check_file "migrations/005_add_simulation.sql" "Migration Simulación"
check_file "migrations/006_fix_routing_functions.sql" "Migration Fixes"
echo ""

echo "🐍 SCRIPTS PYTHON"
echo "─────────────────────────────"
check_file "scripts/mip_optimizer.py" "MIP Optimizer"
check_file "scripts/genetic_algorithm.py" "Algoritmo Genético"
check_file "scripts/calc_prob_batch.py" "Cálculo Probabilidades"
check_file "scripts/quick_load_data.py" "Carga Rápida"
echo ""

echo "📚 DOCUMENTACIÓN"
echo "─────────────────────────────"
check_file "README.md" "README Principal"
check_file "CLAUDE.md" "Contexto del Proyecto"
check_file "EVALUACION_RUBRICA.md" "Evaluación Rúbrica ⭐"
check_file "EVALUACION_FINAL.md" "Evaluación Final ⭐"
check_file "GUIA_REVISION.md" "Guía de Revisión ⭐"
check_file "RUBRICA.md" "Rúbrica Original"
echo ""

echo "═══════════════════════════════════════"
echo "📊 RESUMEN"
echo "═══════════════════════════════════════"
echo -e "Total de verificaciones: $TOTAL"
echo -e "${GREEN}Pasadas: $PASSED${NC}"
echo -e "${RED}Faltantes: $((TOTAL - PASSED))${NC}"
echo ""

# Calcular porcentaje
PERCENTAGE=$((PASSED * 100 / TOTAL))

if [ $PERCENTAGE -eq 100 ]; then
    echo -e "${GREEN}✅ PROYECTO COMPLETO (100%)${NC}"
    echo "🎉 ¡Listo para entrega!"
elif [ $PERCENTAGE -ge 90 ]; then
    echo -e "${GREEN}✅ PROYECTO CASI COMPLETO ($PERCENTAGE%)${NC}"
    echo "⚠️  Revisar archivos faltantes"
elif [ $PERCENTAGE -ge 70 ]; then
    echo -e "${YELLOW}⚠️  PROYECTO PARCIALMENTE COMPLETO ($PERCENTAGE%)${NC}"
    echo "❗ Completar archivos faltantes"
else
    echo -e "${RED}❌ PROYECTO INCOMPLETO ($PERCENTAGE%)${NC}"
    echo "🔧 Implementar archivos faltantes"
fi

echo ""
echo "═══════════════════════════════════════"
echo "🧪 SIGUIENTE PASO: PROBAR EL SISTEMA"
echo "═══════════════════════════════════════"
echo ""
echo "1. Backend:"
echo "   cd backend && npm install && npm start"
echo ""
echo "2. Frontend:"
echo "   cd frontend && npm install && npm run dev"
echo ""
echo "3. Abrir navegador:"
echo "   http://localhost:5173"
echo ""
echo "4. Revisar guía completa:"
echo "   cat GUIA_REVISION.md"
echo ""
