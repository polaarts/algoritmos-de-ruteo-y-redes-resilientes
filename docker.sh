#!/bin/bash
# ============================================================================
# Docker Helper Script for Fiber Network Project
# ============================================================================
# Quick commands to manage the Docker environment
#
# Usage:
#   ./docker.sh [command]
#
# Commands:
#   start       - Start all services
#   stop        - Stop all services
#   restart     - Restart all services
#   logs        - Show logs from all services
#   status      - Show status of all containers
#   clean       - Stop and remove containers
#   reset       - Complete reset (removes volumes)
#   build       - Rebuild all images
#   db          - Connect to database
#   backend     - Open backend shell
#   frontend    - Open frontend shell
#   test        - Run backend tests
#   backup      - Backup database
#   help        - Show this help message
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# Commands
cmd_start() {
    print_info "Starting all services..."
    docker-compose up -d
    print_success "All services started!"
    print_info "Frontend: http://localhost:8080"
    print_info "Backend: http://localhost:5001"
    print_info "Database: localhost:5432"
}

cmd_stop() {
    print_info "Stopping all services..."
    docker-compose stop
    print_success "All services stopped!"
}

cmd_restart() {
    print_info "Restarting all services..."
    docker-compose restart
    print_success "All services restarted!"
}

cmd_logs() {
    print_info "Showing logs (Ctrl+C to exit)..."
    docker-compose logs -f "$@"
}

cmd_status() {
    print_info "Service status:"
    docker-compose ps
}

cmd_clean() {
    print_warning "This will stop and remove all containers"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down
        print_success "Containers removed!"
    else
        print_info "Cancelled"
    fi
}

cmd_reset() {
    print_error "This will DELETE ALL DATA including the database!"
    read -p "Are you ABSOLUTELY sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        print_success "Complete reset done!"
    else
        print_info "Cancelled"
    fi
}

cmd_build() {
    print_info "Rebuilding all images..."
    docker-compose build --no-cache
    print_success "All images rebuilt!"
}

cmd_db() {
    print_info "Connecting to database..."
    docker-compose exec db psql -U postgres -d fiber_network
}

cmd_backend() {
    print_info "Opening backend shell..."
    docker-compose exec backend sh
}

cmd_frontend() {
    print_info "Opening frontend shell..."
    docker-compose exec frontend sh
}

cmd_test() {
    print_info "Running backend tests..."
    docker-compose exec backend npm test
}

cmd_backup() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    print_info "Creating backup: $BACKUP_FILE"
    docker-compose exec -T db pg_dump -U postgres fiber_network > "$BACKUP_FILE"
    print_success "Backup created: $BACKUP_FILE"
}

cmd_help() {
    cat << EOF
Fiber Network Docker Helper

Usage: ./docker.sh [command]

Commands:
  start       Start all services
  stop        Stop all services
  restart     Restart all services
  logs        Show logs from all services (add service name for specific logs)
  status      Show status of all containers
  clean       Stop and remove containers (keeps data)
  reset       Complete reset - DELETES ALL DATA
  build       Rebuild all images
  db          Connect to PostgreSQL database
  backend     Open backend container shell
  frontend    Open frontend container shell
  test        Run backend tests
  backup      Create database backup
  help        Show this help message

Examples:
  ./docker.sh start
  ./docker.sh logs backend
  ./docker.sh db

EOF
}

# Main
case "${1:-help}" in
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    restart)    cmd_restart ;;
    logs)       shift; cmd_logs "$@" ;;
    status)     cmd_status ;;
    clean)      cmd_clean ;;
    reset)      cmd_reset ;;
    build)      cmd_build ;;
    db)         cmd_db ;;
    backend)    cmd_backend ;;
    frontend)   cmd_frontend ;;
    test)       cmd_test ;;
    backup)     cmd_backup ;;
    help)       cmd_help ;;
    *)
        print_error "Unknown command: $1"
        cmd_help
        exit 1
        ;;
esac
