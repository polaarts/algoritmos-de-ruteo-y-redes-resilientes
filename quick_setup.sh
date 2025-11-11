#!/bin/bash

###############################################################################
# QUICK_SETUP.SH - Instalación Rápida del Sistema de Probabilidades
# Proyecto: Resiliencia de Redes de Fibra Óptica en Chile
###############################################################################

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   INSTALACIÓN RÁPIDA - Sistema de Probabilidades             ║
║   Red de Fibra Óptica Resiliente                            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}\n"

# Verificar Docker
echo -e "${BLUE}[1/8]${NC} Verificando Docker..."
if ! docker ps >/dev/null 2>&1; then
    echo -e "${RED}❌ Docker no está corriendo${NC}"
    echo "   Ejecuta: sudo systemctl start docker"
    exit 1
fi
echo -e "${GREEN}✓ Docker OK${NC}"

# Verificar Python
echo -e "${BLUE}[2/8]${NC} Verificando Python..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python3 no encontrado${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python3 OK${NC}"

# Instalar librerías Python (si faltan)
echo -e "${BLUE}[3/8]${NC} Verificando librerías Python..."
python3 -c "import psycopg2" 2>/dev/null || pip3 install psycopg2-binary
python3 -c "import numpy" 2>/dev/null || pip3 install numpy
python3 -c "import scipy" 2>/dev/null || pip3 install scipy
echo -e "${GREEN}✓ Librerías Python OK${NC}"

# Levantar base de datos
echo -e "${BLUE}[4/8]${NC} Levantando base de datos..."
docker-compose up -d db
echo -e "${GREEN}✓ Base de datos iniciada${NC}"

# Esperar a que la BD esté lista
echo -e "${BLUE}[5/8]${NC} Esperando a que PostgreSQL esté listo..."
sleep 10
for i in {1..30}; do
    if docker-compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then
        break
    fi
    echo -n "."
    sleep 1
done
echo -e "\n${GREEN}✓ PostgreSQL listo${NC}"

# Aplicar migraciones
echo -e "${BLUE}[6/8]${NC} Aplicando migraciones..."

echo "   - Aplicando migration 004 (probabilidades)..."
docker-compose exec -T db psql -U postgres -d postgres < migrations/004_add_probabilities.sql

echo "   - Aplicando migration 005 (simulación)..."
docker-compose exec -T db psql -U postgres -d postgres < migrations/005_add_simulation.sql

echo "   - Aplicando funciones de ruteo resiliente..."
docker-compose exec -T db psql -U postgres -d postgres < functions/resilient_routing.sql

echo -e "${GREEN}✓ Migraciones aplicadas${NC}"

# Calcular probabilidades (opcional, solo si hay datos)
echo -e "${BLUE}[7/8]${NC} ¿Calcular probabilidades ahora?"
read -p "   (Recomendado si ya tienes datos cargados) (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "   Calculando probabilidades (esto puede tardar)..."
    python3 scripts/calculate_failure_probabilities.py --limit 100
    echo -e "${GREEN}✓ Probabilidades calculadas${NC}"
else
    echo -e "${YELLOW}⚠ Saltado. Ejecuta manualmente: python3 scripts/calculate_failure_probabilities.py${NC}"
fi

# Reiniciar backend
echo -e "${BLUE}[8/8]${NC} Reiniciando backend..."
docker-compose restart backend 2>/dev/null || echo -e "${YELLOW}⚠ Backend no está en Docker${NC}"
echo -e "${GREEN}✓ Backend reiniciado${NC}"

# Resumen
echo -e "\n${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ INSTALACIÓN COMPLETADA${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}\n"

echo -e "${CYAN}🎯 Nuevos Endpoints Disponibles:${NC}"
echo "   GET  /api/probabilities/edges"
echo "   GET  /api/probabilities/edges/:id"
echo "   GET  /api/probabilities/statistics"
echo "   POST /api/probabilities/calculate"
echo "   GET  /api/routing/calculate-resilient"
echo ""

echo -e "${CYAN}🧪 Prueba Rápida:${NC}"
echo "   curl http://localhost:5000/api/probabilities/statistics"
echo ""

echo -e "${CYAN}📖 Próximos Pasos:${NC}"
echo "   1. Cargar datos si no lo has hecho:"
echo "      python3 load_data_to_db.py"
echo ""
echo "   2. Calcular probabilidades completas:"
echo "      python3 scripts/calculate_failure_probabilities.py"
echo ""
echo "   3. Probar ruteo resiliente:"
echo "      curl 'http://localhost:5000/api/routing/calculate-resilient?start_lat=-33.4489&start_lon=-70.6693&end_lat=-36.8270&end_lon=-73.0498&max_failure_prob=0.3'"
echo ""

echo -e "${YELLOW}⚠️  NOTA: Si el backend no responde, levántalo manualmente:${NC}"
echo "   cd backend && npm install && npm start"
echo ""
