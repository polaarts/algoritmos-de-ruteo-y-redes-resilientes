#!/bin/bash

# =============================================================================
# Script de Inicio - Red de Fibra Óptica Chile
# =============================================================================
# Este script te guía para levantar el proyecto completo
#
# Requisitos:
# - Docker Desktop instalado y corriendo
# =============================================================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║   🌐 Red de Fibra Óptica - Resiliencia en Chile              ║"
echo "║                                                                ║"
echo "║   Script de Inicio Rápido                                     ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Función para mostrar paso
show_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Función para verificar requisitos
check_requirement() {
    if command -v "$1" &> /dev/null; then
        echo -e "${GREEN}✓${NC} $2 instalado"
        return 0
    else
        echo -e "${RED}✗${NC} $2 no encontrado"
        return 1
    fi
}

# Función para preguntar al usuario
ask_user() {
    while true; do
        read -p "$(echo -e ${YELLOW}$1 [s/n]: ${NC})" yn
        case $yn in
            [Ss]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Por favor responde s (sí) o n (no).";;
        esac
    done
}

# =============================================================================
# PASO 1: Verificar requisitos
# =============================================================================
show_step "Paso 1: Verificando requisitos del sistema"

all_requirements_met=true

if ! check_requirement "docker" "Docker"; then
    echo -e "${RED}   → Instala Docker Desktop: https://www.docker.com/products/docker-desktop${NC}"
    all_requirements_met=false
fi

if ! check_requirement "docker-compose" "Docker Compose" && ! docker compose version &> /dev/null; then
    echo -e "${RED}   → Docker Compose no está disponible${NC}"
    all_requirements_met=false
fi

if [ "$all_requirements_met" = false ]; then
    echo ""
    echo -e "${RED}❌ Faltan requisitos. Por favor instálalos y vuelve a ejecutar este script.${NC}"
    exit 1
fi

# Verificar que Docker esté corriendo
if ! docker ps &> /dev/null; then
    echo -e "${RED}✗${NC} Docker no está corriendo"
    echo -e "${YELLOW}   → Inicia Docker Desktop y vuelve a ejecutar este script${NC}"
    exit 1
else
    echo -e "${GREEN}✓${NC} Docker está corriendo"
fi

echo ""
echo -e "${GREEN}✅ Todos los requisitos están listos${NC}"
echo ""
sleep 1

# =============================================================================
# PASO 2: Verificar archivo .env
# =============================================================================
show_step "Paso 2: Configuración de variables de entorno"

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ Archivo .env no encontrado${NC}"
    echo ""
    
    if [ -f ".env.docker.example" ]; then
        echo "Se creará un archivo .env desde .env.docker.example"
        echo ""
        
        if ask_user "¿Deseas crear el archivo .env ahora?"; then
            cp .env.docker.example .env
            echo -e "${GREEN}✓${NC} Archivo .env creado"
            echo ""
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${GREEN}ℹ  La base de datos se ejecuta en un contenedor Docker${NC}"
            echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo ""
            echo "El archivo .env ya viene configurado con los valores por defecto"
            echo "para la base de datos PostgreSQL local en Docker:"
            echo ""
            echo -e "${CYAN}   - DB_HOST=db${NC}"
            echo -e "${CYAN}   - DB_PORT=5432${NC}"
            echo -e "${CYAN}   - DB_NAME=fiber_network${NC}"
            echo -e "${CYAN}   - DB_USER=postgres${NC}"
            echo -e "${CYAN}   - DB_PASSWORD=postgres${NC}"
            echo ""
            echo -e "${GREEN}✓${NC} No necesitas configurar nada más"
        else
            echo ""
            echo -e "${YELLOW}No se puede continuar sin archivo .env${NC}"
            exit 0
        fi
    else
        echo -e "${RED}✗ No se encontró .env.docker.example${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} Archivo .env encontrado"
fi

echo ""
sleep 1

# =============================================================================
# PASO 3: Levantar servicios con Docker
# =============================================================================
show_step "Paso 3: Levantando servicios con Docker"

echo "Se levantarán los siguientes servicios:"
echo ""
echo "  • Database (PostgreSQL + PostGIS) → localhost:5432"
echo "  • Backend  (Node.js + Express)    → http://localhost:3000"
echo "  • Frontend (React + Vite)         → http://localhost:5173"
echo ""

if ask_user "¿Deseas levantar los servicios ahora?"; then
    echo ""
    echo -e "${CYAN}🐳 Iniciando Docker Compose...${NC}"
    echo ""
    
    docker compose up -d
    
    echo ""
    echo -e "${GREEN}✅ Servicios levantados exitosamente${NC}"
    echo ""
    
    # Esperar un momento para que los servicios inicien
    echo "Esperando a que los servicios inicien..."
    echo -e "${CYAN}(La base de datos puede tardar ~10 segundos en estar lista)${NC}"
    sleep 10
    
    # Verificar estado de servicios
    echo ""
    echo -e "${CYAN}📊 Estado de los servicios:${NC}"
    echo ""
    docker compose ps
    
else
    echo ""
    echo "Puedes levantar los servicios manualmente con:"
    echo -e "${CYAN}  docker compose up -d${NC}"
    exit 0
fi

echo ""
sleep 1

# =============================================================================
# PASO 4: Verificar servicios
# =============================================================================
show_step "Paso 4: Verificando servicios"

echo "Verificando que los servicios respondan..."
echo ""

# Verificar Database
echo -n "Database (PostgreSQL)... "
if docker compose exec -T db pg_isready -U postgres &> /dev/null; then
    echo -e "${GREEN}✓ Conectado${NC}"
else
    echo -e "${YELLOW}⚠ No responde aún${NC}"
fi

# Verificar Backend
echo -n "Backend (http://localhost:3000)... "
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null | grep -q "200"; then
    echo -e "${GREEN}✓ Respondiendo${NC}"
else
    echo -e "${YELLOW}⚠ No responde aún (puede tardar unos segundos)${NC}"
fi

# Verificar Frontend
echo -n "Frontend (http://localhost:5173)... "
if curl -s -o /dev/null http://localhost:5173 2>/dev/null; then
    echo -e "${GREEN}✓ Respondiendo${NC}"
else
    echo -e "${YELLOW}⚠ No responde aún (puede tardar unos segundos)${NC}"
fi

echo ""

# =============================================================================
# FINALIZACIÓN
# =============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}║   🎉 ¡Proyecto levantado exitosamente!                        ║${NC}"
echo -e "${GREEN}║                                                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📍 URLs de acceso:${NC}"
echo ""
echo -e "   🌐 Frontend:  ${BLUE}http://localhost:5173${NC}"
echo -e "   🔧 Backend:   ${BLUE}http://localhost:3000${NC}"
echo -e "   🗄️  Database:  ${BLUE}localhost:5432${NC} (postgres/postgres)"
echo ""
echo -e "${CYAN}📚 Comandos útiles:${NC}"
echo ""
echo -e "   Ver logs:              ${YELLOW}docker compose logs -f${NC}"
echo -e "   Ver logs del backend:  ${YELLOW}docker compose logs -f backend${NC}"
echo -e "   Ver logs de la BD:     ${YELLOW}docker compose logs -f db${NC}"
echo -e "   Conectar a la BD:      ${YELLOW}docker compose exec db psql -U postgres fiber_network${NC}"
echo -e "   Reiniciar servicios:   ${YELLOW}docker compose restart${NC}"
echo -e "   Detener servicios:     ${YELLOW}docker compose down${NC}"
echo ""
echo -e "${CYAN}📖 Documentación:${NC}"
echo ""
echo -e "   Inicio rápido:    ${BLUE}docs/QUICKSTART.md${NC}"
echo -e "   Desarrollo:       ${BLUE}docs/development/LOCAL_DEVELOPMENT.md${NC}"
echo -e "   Troubleshooting:  ${BLUE}docs/troubleshooting/${NC}"
echo ""
echo -e "${GREEN}¡Disfruta explorando el proyecto! 🚀${NC}"
echo ""
