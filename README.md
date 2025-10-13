# Resilencia de Redes de Fibra Óptica en zonas críticas de Chile

- Modelar la red de fibra óptica nacional (hay datos públicos de Subtel y del proyecto Fibra Óptica Austral).
- Geolocalizar nodos, rutas y enlaces.
- Simpular cortes físicos provocados por terremotos, deslizamientos o ataques dirigidos a tramos clave.
- Implementar algoritmos de ruteo alternativo para minimizar la pérdida de conectividad.

# Checklist - Trabajo Grupal Fase 2: ETL y Visualización con Leaflet

## Repositorio GitHub

### 0. Diseño de Base de Datos
- [-] Imagen con diagrama de la BD (muestra dimensiones y estructura)
- [-] Archivo `.sql` para crear la BD desde cero

### 1. Carpeta Infraestructura
- [ ] Archivo que automatiza extracción de nodos y aristas
- [ ] Archivo que transforma nodos y aristas a JSON

### 2. Carpeta Metadata
- [ ] Archivo(s) que automatiza(n) extracción de API/BD de metadata
- [ ] Archivo(s) que transforma(n) metadata a JSON
- [ ] Todos los archivos JSON de metadata generados

### 3. Carpeta Amenazas
- [ ] Archivo(s) que automatiza(n) extracción de API/BD de amenazas
- [ ] Archivo(s) que transforma(n) amenazas a JSON
- [ ] Todos los archivos JSON de amenazas generados

### 4. Documentación de JSON/GeoJSON
- [ ] Archivo de documentación para cada JSON generado
- [ ] Explicación de estructura de cada archivo
- [ ] Descripción del significado de cada valor

### 5. Carga a Base de Datos
- [ ] Script de carga para JSON de infraestructura
- [ ] Script(s) de carga para JSON(s) de metadata
- [ ] Script(s) de carga para JSON(s) de amenazas
- [ ] Todos los scripts siguen el diseño de BD establecido

### 6. Carpeta Sitio Web
- [ ] Archivo que crea sitio web con Leaflet
- [ ] Visualización de infraestructura
- [ ] Visualización de metadata
- [ ] Visualización de amenazas

### 7. Implementación de Ruta
- [ ] Ruta generada con `pgr_dijkstra`
- [ ] Uso de longitud como costo
- [ ] Muestra ejemplo de solución al problema
- [ ] Representa peor caso (sin metadata ni amenazas)

### 8. Archivo Main
- [ ] Archivo `main` en carpeta raíz
- [ ] Automatiza descarga de información
- [ ] Automatiza importación a BD
- [ ] Automatiza habilitación de sitio web
- [ ] Ejecuta todo el proceso de forma automática

### 9. Docker
- [ ] Todas las implementaciones corren en contenedores Docker
- [ ] Dockerfile(s) incluido(s)
- [ ] docker-compose.yml (si aplica)
- [ ] Compatibilidad de librerías asegurada
- [ ] Versiones de software compatibles

## Presentación

### Entrega en Canvas
- [ ] Presentación creada
- [ ] Evidencia del proceso ETL (Extract, Transform, Load)
- [ ] Todos los puntos de la rúbrica incluidos
- [ ] Capturas de pantalla o diagramas de cada componente
- [ ] Link al repositorio GitHub
- [ ] Presentación subida a Canvas

### Contenido de la Presentación
- [ ] Diagrama de BD explicado
- [ ] Proceso de extracción demostrado
- [ ] Proceso de transformación demostrado
- [ ] Proceso de carga demostrado
- [ ] Sitio web funcionando
- [ ] Ruta con pgr_dijkstra visualizada
- [ ] Automatización con archivo main demostrada
- [ ] Implementación en Docker explicada