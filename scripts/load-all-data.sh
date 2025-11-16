#!/bin/bash

echo "🌐 SCRIPT DE CARGA COMPLETA DE DATOS"
echo "===================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="c:/Users/SAMUE/Documents/universidad/algoritmos-de-ruteo-y-redes-resilientes"
cd "$PROJECT_DIR"

echo -e "${BLUE}📊 Verificando conexión a la base de datos...${NC}"
docker-compose exec -T db psql -U postgres -d fiber_network -c "SELECT NOW();" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Base de datos no disponible. Iniciando contenedor...${NC}"
    docker-compose up -d db
    sleep 5
fi

echo -e "${GREEN}✅ Base de datos lista${NC}"
echo ""

# 1. Cargar infraestructura (nodos y enlaces)
echo -e "${BLUE}1️⃣  Cargando infraestructura de red...${NC}"
node scripts/load-infrastructure.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Infraestructura cargada${NC}"
else
    echo -e "${YELLOW}⚠️  Error cargando infraestructura${NC}"
fi
echo ""

# 2. Cargar metadata
echo -e "${BLUE}2️⃣  Cargando metadata geográfica...${NC}"
node scripts/load-metadata.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Metadata cargada${NC}"
else
    echo -e "${YELLOW}⚠️  Error cargando metadata${NC}"
fi
echo ""

# 3. Cargar datacenters
echo -e "${BLUE}3️⃣  Cargando datacenters...${NC}"
node scripts/load-datacenters.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Datacenters cargados${NC}"
else
    echo -e "${YELLOW}⚠️  Error cargando datacenters${NC}"
fi
echo ""

# 4. Cargar amenazas
echo -e "${BLUE}4️⃣  Cargando amenazas (clima y fuego)...${NC}"
node scripts/load-threats.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Amenazas cargadas${NC}"
else
    echo -e "${YELLOW}⚠️  Error cargando amenazas${NC}"
fi
echo ""

# 5. Calcular y cargar probabilidades
echo -e "${BLUE}5️⃣  Calculando probabilidades de falla...${NC}"
echo -e "${YELLOW}⏱️  Este proceso puede tomar varios minutos...${NC}"
node scripts/calculate_and_load_probabilities.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Probabilidades calculadas${NC}"
else
    echo -e "${YELLOW}⚠️  Error calculando probabilidades${NC}"
fi
echo ""

# 6. Verificar datos
echo -e "${BLUE}6️⃣  Verificando integridad de datos...${NC}"
node scripts/verificar_datos.js
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Datos verificados${NC}"
else
    echo -e "${YELLOW}⚠️  Error verificando datos${NC}"
fi
echo ""

echo "===================================="
echo -e "${GREEN}✅ PROCESO DE CARGA COMPLETADO${NC}"
echo "===================================="
echo ""
echo "📊 Resumen de la base de datos:"
docker-compose exec -T db psql -U postgres -d fiber_network -c "
SELECT 
    'fiber_nodes' as tabla, COUNT(*) as registros FROM fiber_nodes
UNION ALL
SELECT 'fiber_links', COUNT(*) FROM fiber_links
UNION ALL
SELECT 'datacenters', COUNT(*) FROM datacenters
UNION ALL
SELECT 'ground_type', COUNT(*) FROM ground_type
UNION ALL
SELECT 'weather_events', COUNT(*) FROM weather_events
UNION ALL
SELECT 'fire_risk_zones', COUNT(*) FROM fire_risk_zones
UNION ALL
SELECT 'node_probabilities', COUNT(*) FROM node_probabilities
UNION ALL
SELECT 'edge_probabilities', COUNT(*) FROM edge_probabilities
ORDER BY tabla;
"
