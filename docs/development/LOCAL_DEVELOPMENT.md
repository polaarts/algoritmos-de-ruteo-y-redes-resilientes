# 💻 Guía de Desarrollo Local

Esta guía te ayudará a configurar el entorno de desarrollo para contribuir al proyecto.

## Requisitos del Sistema

- **Node.js**: 18.x o superior
- **npm**: 9.x o superior
- **Git**: 2.x o superior
- **Docker**: 20.10+ (opcional pero recomendado)
- **Editor**: VS Code recomendado

## Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone https://github.com/polaarts/algoritmos-de-ruteo-y-redes-resilientes.git
cd algoritmos-de-ruteo-y-redes-resilientes
```

### 2. Instalar Dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Volver a la raíz
cd ..
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.docker.example .env

# Editar con tus credenciales de Supabase
# Ver: docs/setup/SUPABASE_SETUP.md
```

## Desarrollo con Docker (Recomendado)

### Levantar todos los servicios

```bash
docker compose up -d
```

### Desarrollo con Hot Reload

Los cambios en el código se reflejan automáticamente:

- **Frontend**: Vite con HMR (Hot Module Replacement)
- **Backend**: Nodemon reinicia automáticamente

```bash
# Ver logs del frontend
docker compose logs -f frontend

# Ver logs del backend
docker compose logs -f backend
```

### Editar código

Simplemente edita los archivos y los cambios se aplicarán:

```bash
# Frontend: frontend/src/**
# Backend: backend/**
```

## Desarrollo Sin Docker

### Backend

```bash
cd backend

# Instalar dependencias
npm install

# Modo desarrollo (con nodemon)
npm run dev

# Modo producción
npm start

# Ejecutar tests
npm test
```

El backend estará disponible en: http://localhost:3000

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Modo desarrollo (con hot reload)
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

El frontend estará disponible en: http://localhost:5173

### OSRM (Opcional)

Si necesitas el servicio de routing local:

```bash
docker compose up -d osrm
```

O configura el frontend para usar un OSRM externo.

## Estructura del Proyecto

```
├── backend/               # API REST (Node.js + Express)
│   ├── algorithms/        # Algoritmos de ruteo
│   ├── config/           # Configuración
│   ├── routes/           # Endpoints de la API
│   └── server.js         # Punto de entrada
│
├── frontend/             # Aplicación web (React + Vite)
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── styles/       # CSS
│   │   └── App.jsx       # Componente principal
│   └── index.html
│
├── database/             # Esquema y migraciones
│   ├── schema.sql
│   └── migrations/
│
├── docs/                 # Documentación
│   ├── setup/           # Guías de configuración
│   ├── development/     # Guías de desarrollo
│   └── architecture/    # Diseño del sistema
│
├── scripts/              # Scripts de utilidad
├── osrm-data/           # Datos de OSRM
└── docker-compose.yml   # Configuración Docker
```

## Flujo de Trabajo

### 1. Crear una nueva rama

```bash
git checkout -b feature/nueva-funcionalidad
```

### 2. Desarrollar

```bash
# Hacer cambios en el código
# Los cambios se reflejan automáticamente (hot reload)
```

### 3. Probar

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm run test  # Si hay tests configurados
```

### 4. Commit

```bash
git add .
git commit -m "feat: descripción del cambio"
```

### 5. Push y Pull Request

```bash
git push origin feature/nueva-funcionalidad
# Crear PR en GitHub
```

## Debugging

### Backend (VS Code)

Crear `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/backend/server.js",
      "envFile": "${workspaceFolder}/.env"
    }
  ]
}
```

### Frontend (Chrome DevTools)

1. Abrir http://localhost:5173
2. F12 para abrir DevTools
3. Usar React DevTools extension

### Logs de Docker

```bash
# Ver todos los logs
docker compose logs -f

# Ver logs de un servicio específico
docker compose logs -f backend

# Ver últimas 100 líneas
docker compose logs --tail=100 backend
```

## Testing

### Backend

```bash
cd backend

# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch
npm run test:watch

# Coverage
npm run test:coverage
```

### Frontend

```bash
cd frontend

# Si se configuran tests con Vitest
npm run test
```

## Linting y Formateo

### Backend

```bash
cd backend

# Lint
npm run lint

# Fix automático
npm run lint:fix
```

### Frontend

```bash
cd frontend

# Lint
npm run lint

# Fix automático
npm run lint:fix

# Formatear con Prettier
npm run format
```

## Base de Datos

### Conectarse a Supabase

```bash
# Usando psql
psql "$DATABASE_URL"

# Ejecutar migraciones
npm run db:migrate

# Seed de datos de prueba
npm run db:seed
```

### Consultas útiles

```sql
-- Ver nodos
SELECT id, city, region FROM nodes LIMIT 10;

-- Ver enlaces
SELECT id, source, target, length_km FROM edges LIMIT 10;

-- Ver datacenters
SELECT id, name, city FROM datacenters;
```

## Troubleshooting

### Puerto en uso

```bash
# Encontrar proceso usando puerto 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Matar proceso
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

### Módulos desactualizados

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Cache de Vite

```bash
cd frontend
rm -rf node_modules/.vite
npm run dev
```

## Recursos

- [Node.js Docs](https://nodejs.org/docs/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Express Docs](https://expressjs.com/)
- [Leaflet Docs](https://leafletjs.com/)

## Próximos Pasos

- [Arquitectura del Sistema](../architecture/ARCHITECTURE.md)
- [Guía de Contribución](../../CONTRIBUTING.md)
- [Configuración de Docker](../setup/DOCKER_SETUP.md)
