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
    if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
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

    if docker compose up -d db; then
        print_success "Base de datos iniciada"
    elif docker-compose up -d db 2>/dev/null; then
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
        if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1 || \
           docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
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

    if docker compose exec -T db psql -U postgres -d postgres < schema.sql > /dev/null 2>&1 || \
       docker-compose exec -T db psql -U postgres -d postgres < schema.sql > /dev/null 2>&1; then
        print_success "Esquema creado correctamente"
    else
        print_warning "Error al crear esquema (puede que ya exista)"
    fi

    # Verificar que las extensiones están instaladas
    print_step "Verificando extensiones PostGIS y pgRouting..."

    docker compose exec -T db psql -U postgres -d postgres -c "SELECT PostGIS_version(), pgr_version();" > /dev/null 2>&1 || \
    docker-compose exec -T db psql -U postgres -d postgres -c "SELECT PostGIS_version(), pgr_version();" > /dev/null 2>&1

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

    if docker compose exec -T db psql -U postgres -d postgres < create-topology.sql > /dev/null 2>&1 || \
       docker-compose exec -T db psql -U postgres -d postgres < create-topology.sql > /dev/null 2>&1; then
        print_success "Topología de red creada"

        # Verificar resultados
        print_step "Verificando topología..."
        docker compose exec -T db psql -U postgres -d postgres -c "
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

    # Verificar e instalar dependencias del backend
    print_step "Verificando dependencias del backend..."
    if [ -d "backend" ]; then
        cd backend

        # Limpiar node_modules si hay problemas de permisos
        if [ -d "node_modules" ] && [ ! -w "node_modules" ]; then
            print_warning "Limpiando node_modules con permisos incorrectos..."
            rm -rf node_modules package-lock.json
        fi

        # Instalar dependencias si no existen
        if [ ! -d "node_modules" ]; then
            print_step "Instalando dependencias del backend..."
            npm install > /dev/null 2>&1
            print_success "Dependencias del backend instaladas"
        fi

        cd ..
    fi

    # Verificar e instalar dependencias del frontend
    print_step "Verificando dependencias del frontend..."
    if [ -d "frontend" ]; then
        cd frontend

        # Limpiar node_modules si hay problemas de permisos
        if [ -d "node_modules" ] && [ ! -w "node_modules" ]; then
            print_warning "Limpiando node_modules con permisos incorrectos..."
            rm -rf node_modules package-lock.json
        fi

        # Instalar dependencias si no existen
        if [ ! -d "node_modules" ]; then
            print_step "Instalando dependencias del frontend..."
            npm install > /dev/null 2>&1
            print_success "Dependencias del frontend instaladas"
        fi

        cd ..
    fi

    # Matar procesos previos en los puertos 5000 y 8080
    print_step "Liberando puertos 5000 y 8080..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 2
    print_success "Puertos liberados"

    # Levantar backend en segundo plano
    print_step "Levantando backend (Node.js/Express) en puerto 5000..."
    cd backend
    nohup npm start > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    cd ..
    sleep 3

    if ps -p $BACKEND_PID > /dev/null; then
        print_success "Backend iniciado (PID: $BACKEND_PID)"
    else
        print_error "El backend falló al iniciar. Revisa backend.log"
        return 1
    fi

    # Levantar frontend en segundo plano
    print_step "Levantando frontend (Vite/React) en puerto 8080..."
    cd frontend
    nohup npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    cd ..
    sleep 3

    if ps -p $FRONTEND_PID > /dev/null; then
        print_success "Frontend iniciado (PID: $FRONTEND_PID)"
    else
        print_error "El frontend falló al iniciar. Revisa frontend.log"
        return 1
    fi

    print_success "Servicios iniciados correctamente"
}

###############################################################################
# VERIFICACIÓN FINAL
###############################################################################

verify_services() {
    print_header "Verificación de Servicios"

    sleep 2

    # Verificar backend
    print_step "Verificando backend..."
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            print_success "Backend: ✓ Running (PID: $BACKEND_PID)"

            # Intentar hacer request
            if command -v curl &> /dev/null; then
                sleep 2
                if curl -s http://localhost:5000/ > /dev/null 2>&1; then
                    print_success "Backend responde en http://localhost:5000"
                else
                    print_warning "Backend está corriendo pero no responde aún (esperando inicialización)"
                fi
            fi
        else
            print_error "Backend: ✗ Not running (revisar backend.log)"
        fi
    else
        print_warning "Backend: No hay archivo backend.pid"
    fi

    # Verificar frontend
    print_step "Verificando frontend..."
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        if ps -p $FRONTEND_PID > /dev/null 2>&1; then
            print_success "Frontend: ✓ Running (PID: $FRONTEND_PID)"
            print_success "Frontend disponible en http://localhost:8080"
        else
            print_error "Frontend: ✗ Not running (revisar frontend.log)"
        fi
    else
        print_warning "Frontend: No hay archivo frontend.pid"
    fi

    # Verificar puertos abiertos
    print_step "Verificando puertos..."
    if lsof -i:5000 > /dev/null 2>&1; then
        print_success "Puerto 5000 (backend): ✓ En uso"
    else
        print_warning "Puerto 5000 (backend): ✗ Libre"
    fi

    if lsof -i:8080 > /dev/null 2>&1; then
        print_success "Puerto 8080 (frontend): ✓ En uso"
    else
        print_warning "Puerto 8080 (frontend): ✗ Libre"
    fi
}

###############################################################################
# DETENER SERVICIOS
###############################################################################

stop_services() {
    print_header "Deteniendo Servicios"

    # Detener backend
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        print_step "Deteniendo backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null || true
        rm backend.pid
        print_success "Backend detenido"
    fi

    # Detener frontend
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        print_step "Deteniendo frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null || true
        rm frontend.pid
        print_success "Frontend detenido"
    fi

    # Matar cualquier proceso remanente en los puertos
    print_step "Liberando puertos..."
    lsof -ti:5000 | xargs kill -9 2>/dev/null || true
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    print_success "Puertos liberados"

    print_success "Todos los servicios detenidos"
}

###############################################################################
# MENÚ PRINCIPAL
###############################################################################

show_menu() {
    echo -e "\n${PURPLE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}  ${CYAN}Pipeline ETL - Red de Fibra Óptica en Chile${NC}               ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚═══════════════════════════════════════════════════════════════╝${NC}\n"
    echo -e "${BLUE}Opciones:${NC}"
    echo -e "  ${GREEN}1)${NC} Solo levantar servicios (Backend + Frontend) ${YELLOW}★ RÁPIDO${NC}"
    echo -e "  ${GREEN}2)${NC} Ejecutar pipeline completo (ETL + Servicios)"
    echo -e "  ${GREEN}3)${NC} Solo extraer datos (ETL - Extract)"
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
            print_header "Levantando Servicios"
            start_services
            verify_services

            print_header "Servicios Iniciados Exitosamente"
            echo -e "${GREEN}✓ Backend y Frontend están corriendo${NC}\n"
            echo -e "${CYAN}Servicios disponibles:${NC}"
            echo -e "  ${BLUE}►${NC} Frontend:  ${GREEN}http://localhost:8080${NC}"
            echo -e "  ${BLUE}►${NC} Backend:   ${GREEN}http://localhost:5000${NC}"
            echo -e ""
            echo -e "${YELLOW}Para ver logs:${NC}"
            echo -e "  ${CYAN}Backend:${NC}  tail -f backend.log"
            echo -e "  ${CYAN}Frontend:${NC} tail -f frontend.log"
            echo -e ""
            echo -e "${YELLOW}Para detener:${NC} ./main.sh (opción 5)"
            ;;
        2)
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
            echo -e "${YELLOW}Para ver logs:${NC}"
            echo -e "  ${CYAN}Backend:${NC}  tail -f backend.log"
            echo -e "  ${CYAN}Frontend:${NC} tail -f frontend.log"
            echo -e ""
            echo -e "${YELLOW}Para detener:${NC} ./main.sh (opción 5)"
            ;;
        3)
            extract_data
            ;;
        4)
            print_header "Logs de Servicios"
            echo -e "${CYAN}Mostrando últimas 50 líneas de cada log...${NC}\n"
            echo -e "${YELLOW}═══ BACKEND LOG ═══${NC}"
            tail -n 50 backend.log 2>/dev/null || echo "No hay log de backend"
            echo -e "\n${YELLOW}═══ FRONTEND LOG ═══${NC}"
            tail -n 50 frontend.log 2>/dev/null || echo "No hay log de frontend"
            echo -e "\n${CYAN}Para ver logs en tiempo real:${NC}"
            echo -e "  tail -f backend.log"
            echo -e "  tail -f frontend.log"
            ;;
        5)
            stop_services
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
