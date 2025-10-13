# Frontend - Fiber Optic Network Visualization

Frontend desarrollado con **Vite + React + Leaflet** para la visualización interactiva de la red de fibra óptica de Chile y análisis de resiliencia.

## Tecnologías

- **React 18** - Biblioteca de UI
- **Vite 5** - Build tool y dev server
- **Leaflet + React-Leaflet** - Mapas interactivos
- **Axios** - Cliente HTTP
- **CSS3** - Estilos personalizados

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/
│   │   ├── Map.jsx                    # Componente base del mapa Leaflet
│   │   ├── InfrastructureLayer.jsx    # Capa de infraestructura (edges, nodes, datacenters)
│   │   ├── ThreatsLayer.jsx           # Capa de amenazas (sismos, incendios, clima)
│   │   └── RouteCalculator.jsx        # Calculador de rutas con pgr_dijkstra
│   ├── services/
│   │   └── api.js                     # Cliente API REST
│   ├── styles/
│   │   ├── index.css                  # Estilos globales
│   │   └── App.css                    # Estilos del componente principal
│   ├── App.jsx                        # Componente principal
│   └── main.jsx                       # Punto de entrada
├── index.html                         # Template HTML
├── vite.config.js                     # Configuración de Vite
├── package.json                       # Dependencias
├── Dockerfile                         # Imagen Docker multi-stage
├── nginx.conf                         # Configuración de Nginx
└── README.md                          # Este archivo
```

## Instalación y Uso

### 1. Instalar dependencias

```bash
cd frontend
npm install
```

### 2. Configurar variables de entorno

Copia el archivo `.env.example` a `.env`:

```bash
cp .env.example .env
```

Edita `.env` para configurar la URL del backend:

```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Ejecutar en modo desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`

### 4. Build para producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`

### 5. Preview del build

```bash
npm run preview
```

## Características Principales

### 📍 Visualización de Capas

**Infraestructura:**
- ✅ Enlaces de fibra óptica (edges) con colores por tipo de vía
- ✅ Nodos de red
- ✅ Datacenters con iconos personalizados

**Amenazas:**
- ✅ Sismos con tamaño y color según magnitud
- ✅ Zonas de riesgo de incendio
- ✅ Eventos climáticos extremos

### 🛣️ Ruteo con pgr_dijkstra

- ✅ Cálculo de rutas más cortas
- ✅ Visualización de ruta de ejemplo (Santiago → Concepción)
- ✅ Selección interactiva de puntos en el mapa
- ✅ Información detallada de la ruta (distancia, algoritmo, número de enlaces)
- ✅ Marcadores de inicio y fin

### 🎛️ Controles

- Sidebar plegable con controles de capas
- Checkboxes para mostrar/ocultar capas
- Leyenda de colores
- Panel de información de ruta
- Popups informativos al hacer clic

### 🎨 UI/UX

- Diseño responsive
- Animaciones suaves
- Loading indicators
- Error handling
- Sidebar colapsable
- Tooltips y popups informativos

## Endpoints API Utilizados

El frontend consume los siguientes endpoints del backend:

```
GET /api/infrastructure/edges       - Obtener enlaces
GET /api/infrastructure/nodes       - Obtener nodos
GET /api/metadata/datacenters       - Obtener datacenters
GET /api/threats/earthquakes        - Obtener sismos
GET /api/threats/fire-zones         - Obtener zonas de incendio
GET /api/threats/weather-events     - Obtener eventos climáticos
GET /api/routing/calculate          - Calcular ruta
GET /api/routing/example            - Obtener ruta de ejemplo
```

## Docker

### Construir imagen

```bash
docker build -t fiber-network-frontend .
```

### Ejecutar contenedor

```bash
docker run -p 8080:80 fiber-network-frontend
```

### Con docker-compose

Desde la raíz del proyecto:

```bash
docker-compose up frontend
```

## Estructura de Componentes

### `<App />`
Componente principal que gestiona el estado de las capas y coordina todos los componentes hijos.

### `<Map />`
Wrapper de React-Leaflet que configura el mapa base con tiles de OpenStreetMap.

### `<InfrastructureLayer />`
- Obtiene y renderiza edges (enlaces de fibra)
- Obtiene y renderiza nodes (nodos de red)
- Obtiene y renderiza datacenters
- Estilos por tipo de vía
- Popups con información detallada

### `<ThreatsLayer />`
- Obtiene y renderiza sismos como CircleMarkers
- Obtiene y renderiza zonas de incendio como polígonos
- Obtiene y renderiza eventos climáticos
- Colores según nivel de severidad/magnitud

### `<RouteCalculator />`
- Carga ruta de ejemplo automáticamente
- Permite calcular rutas personalizadas
- Selección interactiva de puntos en el mapa
- Visualiza ruta con estilo personalizado
- Muestra información de la ruta (distancia, algoritmo, etc.)

## Personalización

### Cambiar mapa base

Edita `src/components/Map.jsx` y descomenta una de las capas alternativas:

```jsx
{/* Satellite view */}
<TileLayer
  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
  attribution='Tiles &copy; Esri'
/>
```

### Cambiar colores de capas

Edita las funciones de estilo en cada componente de capa:

```javascript
// En InfrastructureLayer.jsx
const edgeStyle = (feature) => {
  // Personaliza colores aquí
  return { color: '#custom-color', weight: 2 };
};
```

### Agregar nuevas capas

1. Crea un nuevo componente en `src/components/`
2. Importa y usa en `<App />`
3. Agrega controles en el sidebar

## Troubleshooting

### Error: "Network Error" al cargar datos

- Verifica que el backend esté corriendo en `http://localhost:5000`
- Verifica la variable de entorno `VITE_API_URL` en `.env`
- Revisa la consola del navegador para más detalles

### Mapa no se muestra

- Asegúrate de que Leaflet CSS esté importado en `Map.jsx`
- Verifica que el contenedor tenga altura definida en CSS
- Revisa errores en la consola del navegador

### Rutas no se calculan

- Verifica que el backend tenga la topología creada
- Usa el endpoint `/api/routing/topology-status` para verificar
- Asegúrate de que los datos estén cargados en la base de datos

### Build falla

- Verifica que todas las dependencias estén instaladas
- Ejecuta `npm ci` para instalar dependencias limpias
- Revisa que no haya errores de TypeScript/ESLint

## Scripts Disponibles

```bash
npm run dev        # Desarrollo con hot-reload
npm run build      # Build para producción
npm run preview    # Preview del build
npm run lint       # Linter
```

## Optimizaciones

- **Code splitting** automático con Vite
- **Lazy loading** de componentes
- **Compresión gzip** en nginx
- **Cache** de assets estáticos
- **Multi-stage build** en Docker para imágenes optimizadas

## Próximas Mejoras (Fase 3)

- [ ] Filtros avanzados por región/tipo
- [ ] Rutas considerando amenazas (ponderación)
- [ ] Comparación de rutas (más corta vs más segura)
- [ ] Análisis de conectividad
- [ ] Simulación de cortes
- [ ] Exportar rutas a diferentes formatos
- [ ] Modo oscuro
- [ ] Métricas en tiempo real

## Contribución

Ver `../README.md` para información del proyecto completo.

## Licencia

MIT

## Autores

- Samuel
- Agustín
