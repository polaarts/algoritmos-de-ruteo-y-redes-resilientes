#!/bin/bash

###############################################################################
# MAIN.SH - Script de Automatización ETL Completo
# Proyecto: Resiliencia de Redes de Fibra Óptica en Chile
# Autores: Samuel & Agustín
###############################################################################
# Este script automatiza:
# 1. Extracción de datos (infraestructura, metadata, amenazas)
# 2. Levantamiento de base de datos PostgreSQL/PostGIS
# 3. Creación de esquema de BD
# 4. Carga de datos a la BD
# 5. Creación de topología de red para pgRouting
# 6. Levantamiento de servicios (backend + frontend)
###############################################################################

set -e  # Detener en caso de error

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Variables de configuración
LOG_FILE="main.log"
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

###############################################################################
# FUNCIONES AUXILIARES
###############################################################################

# Función para imprimir mensajes con colores
print_header() {
    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}\n"
}

print_step() {
    echo -e "${CYAN}➜ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ Error: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ Advertencia: $1${NC}"
}

# Función para ejecutar comandos con logging
run_command() {
    local description=$1
    local command=$2

    print_step "$description"

    if eval "$command" >> "$LOG_FILE" 2>&1; then
        print_success "$description completado"
        return 0
    else
        print_error "$description falló. Ver $LOG_FILE para detalles."
        return 1
    fi
}

# Verificar que estamos en el directorio correcto
check_directory() {
    if [ ! -f "schema.sql" ]; then
        print_error "No se encuentra schema.sql. ¿Estás en el directorio raíz del proyecto?"
        exit 1
    fi
}

# Verificar dependencias
check_dependencies() {
    print_header "Verificando Dependencias"

    local missing_deps=0

    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker no está instalado"
        missing_deps=1
    else
        print_success "Docker instalado"
    fi

    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose no está instalado"
        missing_deps=1
    else
        print_success "Docker Compose instalado"
    fi

    # Verificar Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python3 no está instalado"
        missing_deps=1
    else
        print_success "Python3 instalado"
    fi

    # Verificar Node.js (opcional, para desarrollo)
    if ! command -v node &> /dev/null; then
        print_warning "Node.js no está instalado (necesario solo para desarrollo)"
    else
        print_success "Node.js instalado"
    fi

    if [ $missing_deps -eq 1 ]; then
        print_error "Faltan dependencias. Por favor instálalas antes de continuar."
        exit 1
    fi
}

###############################################################################
# PASO 1: EXTRACCIÓN DE DATOS (ETL - Extract)
###############################################################################

extract_data() {
    print_header "PASO 1: Extracción de Datos (Extract)"

    # Crear directorios de cache si no existen
    mkdir -p amenazas/cache
    mkdir -p metadata/cache
    mkdir -p infraestructura/cache

    # 1.1 Extracción de Infraestructura
    if [ -f "infraestructura/extract_infrastructure.py" ]; then
        print_step "Extrayendo infraestructura de red..."
        if python3 infraestructura/extract_infrastructure.py; then
            print_success "Infraestructura extraída"
        else
            print_warning "Error al extraer infraestructura (puede que ya exista)"
        fi
    else
        print_warning "Script de extracción de infraestructura no encontrado"
    fi

    # 1.2 Extracción de Metadata
    if [ -f "metadata/extract_all_metadata.py" ]; then
        print_step "Extrayendo metadata (datacenters, densidad poblacional)..."
        if python3 metadata/extract_all_metadata.py; then
            print_success "Metadata extraída"
        else
            print_warning "Error al extraer metadata (puede que ya exista)"
        fi
    else
        print_warning "Script de extracción de metadata no encontrado"
    fi

    # 1.3 Extracción de Amenazas
    if [ -f "amenazas/extract_all_threats.py" ]; then
        print_step "Extrayendo amenazas (sismos, incendios, clima)..."
        if python3 amenazas/extract_all_threats.py; then
            print_success "Amenazas extraídas"
        else
            print_warning "Error al extraer amenazas (puede que ya exista)"
        fi
    else
        print_warning "Script de extracción de amenazas no encontrado"
    fi

    print_success "Extracción de datos completada"
}

###############################################################################
# PASO 2: LEVANTAR BASE DE DATOS
###############################################################################

start_database() {
    print_header "PASO 2: Iniciando Base de Datos PostgreSQL/PostGIS"

    print_step "Levantando contenedor de base de datos..."

    if docker-compose up -d db; then
        print_success "Base de datos iniciada"
    elif docker compose up -d db; then
        print_success "Base de datos iniciada"
    else
        print_error "No se pudo iniciar la base de datos"
        exit 1
    fi

    # Esperar a que la BD esté lista
    print_step "Esperando a que la base de datos esté lista..."
    sleep 10

    # Verificar que la BD responde
    local max_retries=30
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || \
           docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
            print_success "Base de datos lista"
            return 0
        fi

        retry=$((retry + 1))
        echo -n "."
        sleep 2
    done

    print_error "La base de datos no respondió a tiempo"
    exit 1
}

###############################################################################
# PASO 3: CREAR ESQUEMA DE BD
###############################################################################

create_schema() {
    print_header "PASO 3: Creando Esquema de Base de Datos"

    print_step "Ejecutando schema.sql..."

    if docker-compose exec -T db psql -U postgres -d postgres < schema.sql > /dev/null 2>&1 || \
       docker compose exec -T db psql -U postgres -d postgres < schema.sql > /dev/null 2>&1; then
        print_success "Esquema creado correctamente"
    else
        print_warning "Error al crear esquema (puede que ya exista)"
    fi

    # Verificar que las extensiones están instaladas
    print_step "Verificando extensiones PostGIS y pgRouting..."

    docker-compose exec -T db psql -U postgres -d postgres -c "SELECT PostGIS_version(), pgr_version();" > /dev/null 2>&1 || \
    docker compose exec -T db psql -U postgres -d postgres -c "SELECT PostGIS_version(), pgr_version();" > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        print_success "Extensiones verificadas"
    else
        print_error "Las extensiones PostGIS/pgRouting no están disponibles"
        exit 1
    fi
}

###############################################################################
# PASO 4: CARGAR DATOS A LA BD
###############################################################################

load_data() {
    print_header "PASO 4: Cargando Datos a la Base de Datos"

    print_warning "NOTA: Los scripts de carga (load_to_db.py) deben crearse"
    print_warning "Por ahora, los datos se cargarán manualmente o mediante scripts personalizados"

    # Aquí irían los scripts de carga cuando estén implementados
    # Por ejemplo:
    # - python3 infraestructura/load_to_db.py
    # - python3 metadata/load_to_db.py
    # - python3 amenazas/load_to_db.py

    print_step "Si tienes scripts de carga (load_to_db.py), ejecútalos ahora"
    print_step "O carga los datos manualmente a Supabase/PostgreSQL"
}

###############################################################################
# PASO 5: CREAR TOPOLOGÍA DE RED
###############################################################################

create_topology() {
    print_header "PASO 5: Creando Topología de Red para pgRouting"

    if [ ! -f "create-topology.sql" ]; then
        print_warning "Archivo create-topology.sql no encontrado"
        print_warning "La topología debe crearse manualmente en Supabase"
        return
    fi

    print_step "Ejecutando create-topology.sql..."

    if docker-compose exec -T db psql -U postgres -d postgres < create-topology.sql > /dev/null 2>&1 || \
       docker compose exec -T db psql -U postgres -d postgres < create-topology.sql > /dev/null 2>&1; then
        print_success "Topología de red creada"

        # Verificar resultados
        print_step "Verificando topología..."
        docker-compose exec -T db psql -U postgres -d postgres -c "
            SELECT
                COUNT(*) as total_edges,
                COUNT(CASE WHEN source IS NOT NULL AND target IS NOT NULL THEN 1 END) as edges_with_topology
            FROM edges;
        " 2>&1 | grep -E "total_edges|edges_with_topology" || true

    else
        print_warning "Error al crear topología. Si usas Supabase, ejecútalo manualmente en SQL Editor"
    fi
}

###############################################################################
# PASO 6: LEVANTAR SERVICIOS (BACKEND + FRONTEND)
###############################################################################

start_services() {
    print_header "PASO 6: Levantando Servicios Web"

    # Levantar backend
    print_step "Levantando backend (Node.js/Express)..."

    if docker-compose up -d backend || docker compose up -d backend; then
        print_success "Backend iniciado"
    else
        print_error "No se pudo iniciar el backend"
        print_warning "Puedes ejecutarlo manualmente: cd backend && npm install && npm start"
    fi

    # Esperar un poco
    sleep 5

    # Levantar frontend
    print_step "Levantando frontend (Vite/React)..."

    if docker-compose up -d frontend || docker compose up -d frontend; then
        print_success "Frontend iniciado"
    else
        print_error "No se pudo iniciar el frontend"
        print_warning "Puedes ejecutarlo manualmente: cd frontend && npm install && npm run dev"
    fi
}

###############################################################################
# VERIFICACIÓN FINAL
###############################################################################

verify_services() {
    print_header "Verificación de Servicios"

    sleep 5

    # Verificar base de datos
    print_step "Verificando base de datos..."
    if docker-compose ps db | grep -q "Up" || docker compose ps db | grep -q "Up"; then
        print_success "Base de datos: ✓ Running"
    else
        print_error "Base de datos: ✗ Not running"
    fi

    # Verificar backend
    print_step "Verificando backend..."
    if docker-compose ps backend | grep -q "Up" || docker compose ps backend | grep -q "Up"; then
        print_success "Backend: ✓ Running"

        # Intentar hacer request a health endpoint
        if command -v curl &> /dev/null; then
            if curl -s http://localhost:5000/health > /dev/null 2>&1; then
                print_success "Backend responde en http://localhost:5000"
            fi
        fi
    else
        print_warning "Backend: No está en Docker (puede estar ejecutándose localmente)"
    fi

    # Verificar frontend
    print_step "Verificando frontend..."
    if docker-compose ps frontend | grep -q "Up" || docker compose ps frontend | grep -q "Up"; then
        print_success "Frontend: ✓ Running"
        print_success "Frontend disponible en http://localhost:8080"
    else
        print_warning "Frontend: No está en Docker (puede estar ejecutándose localmente)"
    fi
}

###############################################################################
# MENÚ PRINCIPAL
###############################################################################

show_menu() {
    echo -e "\n${PURPLE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${CYAN}Pipeline ETL - Red de Fibra Óptica en Chile${NC}               ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
    echo -e "${BLUE}Opciones:${NC}"
    echo -e "  ${GREEN}1)${NC} Ejecutar pipeline completo (Recomendado)"
    echo -e "  ${GREEN}2)${NC} Solo extraer datos (ETL - Extract)"
    echo -e "  ${GREEN}3)${NC} Solo levantar servicios (Docker)"
    echo -e "  ${GREEN}4)${NC} Ver logs de servicios"
    echo -e "  ${GREEN}5)${NC} Detener todos los servicios"
    echo -e "  ${GREEN}6)${NC} Verificar estado de servicios"
    echo -e "  ${GREEN}0)${NC} Salir"
    echo -e ""
    read -p "Selecciona una opción: " choice
    echo ""
}

###############################################################################
# FUNCIÓN PRINCIPAL
###############################################################################

main() {
    # Banner
    echo -e "${PURPLE}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║   ███████╗██╗██████╗ ███████╗██████╗      ███╗   ██╗███████╗████████╗║
║   ██╔════╝██║██╔══██╗██╔════╝██╔══██╗     ████╗  ██║██╔════╝╚══██╔══╝║
║   █████╗  ██║██████╔╝█████╗  ██████╔╝     ██╔██╗ ██║█████╗     ██║   ║
║   ██╔══╝  ██║██╔══██╗██╔══╝  ██╔══██╗     ██║╚██╗██║██╔══╝     ██║   ║
║   ██║     ██║██████╔╝███████╗██║  ██║     ██║ ╚████║███████╗   ██║   ║
║   ╚═╝     ╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝     ╚═╝  ╚═══╝╚══════╝   ╚═╝   ║
║                                                                       ║
║           Resiliencia de Redes de Fibra Óptica en Chile             ║
║                    ETL Pipeline Automation                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}\n"

    # Inicializar log
    echo "=== Pipeline ETL iniciado: $TIMESTAMP ===" > "$LOG_FILE"

    # Verificar directorio y dependencias
    check_directory
    check_dependencies

    # Mostrar menú
    show_menu

    case $choice in
        1)
            print_header "Ejecutando Pipeline Completo"
            extract_data
            start_database
            create_schema
            load_data
            create_topology
            start_services
            verify_services

            print_header "Pipeline Completado Exitosamente"
            echo -e "${GREEN}✓ Todos los pasos completados${NC}\n"
            echo -e "${CYAN}Servicios disponibles:${NC}"
            echo -e "  ${BLUE}►${NC} Frontend:  ${GREEN}http://localhost:8080${NC}"
            echo -e "  ${BLUE}►${NC} Backend:   ${GREEN}http://localhost:5000${NC}"
            echo -e "  ${BLUE}►${NC} Database:  ${GREEN}localhost:5432${NC}"
            echo -e ""
            echo -e "${YELLOW}Para ver logs:${NC} docker-compose logs -f"
            echo -e "${YELLOW}Para detener:${NC} docker-compose down"
            ;;
        2)
            extract_data
            ;;
        3)
            start_database
            start_services
            verify_services
            ;;
        4)
            print_header "Logs de Servicios"
            docker-compose logs --tail=50 -f || docker compose logs --tail=50 -f
            ;;
        5)
            print_header "Deteniendo Servicios"
            docker-compose down || docker compose down
            print_success "Servicios detenidos"
            ;;
        6)
            verify_services
            ;;
        0)
            echo -e "${CYAN}Saliendo...${NC}"
            exit 0
            ;;
        *)
            print_error "Opción inválida"
            exit 1
            ;;
    esac

    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ Proceso finalizado correctamente${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}\n"
}

# Ejecutar función principal
main "$@"
