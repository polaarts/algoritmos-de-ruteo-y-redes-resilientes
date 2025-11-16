# 🗺️ Rutas Realistas con Leaflet Routing Machine

## ✅ Implementación Completa (Sin OSRM Local)

Esta solución genera rutas de fibra óptica realistas **directamente desde el frontend** sin necesidad de configurar un servidor OSRM local.

## 🎯 ¿Qué hace?

- ✅ Genera rutas realistas entre **9 datacenters** de la Región del Biobío
- ✅ Crea **36 enlaces** siguiendo carreteras reales
- ✅ Usa el servicio **OSRM público gratuito**
- ✅ No requiere servidor adicional
- ✅ 100% en el frontend con React + Leaflet

---

## 📦 Componentes Creados

### 1. **RealisticFiberLinks.jsx**
Componente de React que:
- Obtiene datacenters de la región desde el backend
- Genera todas las combinaciones de pares (36 rutas)
- Usa Leaflet Routing Machine con OSRM público
- Renderiza las rutas en el mapa
- Muestra progreso e indicadores visuales

### 2. **Backend API: `/api/infrastructure/datacenters`**
Nuevo endpoint que:
- Devuelve todos los datacenters
- Permite filtrar por región
- Incluye coordenadas (lon, lat)
- Formato optimizado para frontend

---

## 🚀 Uso

### Activar rutas realistas:

1. **Abre el frontend:** http://localhost:8080

2. **En el sidebar, busca "Infraestructura"**

3. **Activa el checkbox:** ✅ 🗺️ Rutas Realistas (Biobío)

4. **Observa:** Las rutas se generan automáticamente siguiendo carreteras reales

---

## 🔧 Arquitectura

```
┌─────────────────────────────────────────┐
│          FRONTEND (React)               │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  RealisticFiberLinks.jsx          │ │
│  │  - Carga datacenters              │ │
│  │  - Genera 36 pares                │ │
│  │  - Usa Leaflet Routing Machine    │ │
│  └───────────────┬───────────────────┘ │
│                  │                      │
└──────────────────┼──────────────────────┘
                   │
                   ├─► Backend API
                   │   /api/infrastructure/datacenters
                   │   (PostgreSQL)
                   │
                   └─► OSRM Público
                       https://router.project-osrm.org
                       (Servicio gratuito)
```

---

## 📊 Resultados

### Datacenters Conectados (Región del Biobío)

| Ciudad | Empresa | Coordenadas |
|--------|---------|-------------|
| Concepción | Movistar | -73.0444, -36.8201 |
| Talcahuano | VTR | -73.1165, -36.7249 |
| Chillán | Entel | -72.1033, -36.6067 |
| Los Ángeles | GTD | -72.3536, -37.4695 |
| Los Álamos | Claro | -73.4118, -37.6272 |
| Coronel | Telefónica | -73.1605, -37.0330 |
| Tomé | WOM | -72.9570, -36.6181 |
| Lota | Claro | -73.1584, -37.0895 |
| Mulchén | Entel | -72.2396, -37.7191 |

**Total:** 9 datacenters → **36 rutas** (grafo completo)

---

## 💡 Ventajas vs OSRM Local

| Característica | OSRM Local | Leaflet Routing Machine |
|----------------|------------|-------------------------|
| **Setup** | 15-20 min | ✅ Ya funciona |
| **Descarga de datos** | ~300MB | ✅ No necesario |
| **Servidor adicional** | Docker requerido | ✅ No necesario |
| **Mantenimiento** | Actualizar datos OSM | ✅ Servicio público |
| **Costo** | Servidor + almacenamiento | ✅ Gratis ilimitado* |
| **Complejidad** | Alta | ✅ Baja |
| **Calidad de rutas** | Excelente | ✅ Excelente (mismo motor) |

*El servicio OSRM público tiene rate limits razonables para desarrollo

---

## 🎨 Personalización

### Cambiar color de las rutas:

```javascript
// En RealisticFiberLinks.jsx, línea ~80
lineOptions: {
  styles: [
    { 
      color: '#2563eb',  // Cambiar este color
      opacity: 0.6,
      weight: 3
    }
  ]
}
```

### Cambiar región:

```javascript
// En App.jsx, donde se usa el componente
<RealisticFiberLinks 
  enabled={layers.showRealisticRoutes}
  region="Región Metropolitana"  // Cambiar región
/>
```

### Agregar más regiones:

En el sidebar, puedes crear múltiples checkboxes:

```jsx
<label>
  <input
    type="checkbox"
    checked={layers.showRealisticRoutesBiobio}
    onChange={() => toggleLayer('showRealisticRoutesBiobio')}
  />
  Rutas Biobío
</label>

<label>
  <input
    type="checkbox"
    checked={layers.showRealisticRoutesRM}
    onChange={() => toggleLayer('showRealisticRoutesRM')}
  />
  Rutas Metropolitana
</label>
```

---

## 🔍 Verificación

### 1. Verificar que el backend responde:

```bash
curl "http://localhost:5000/api/infrastructure/datacenters?region=Regi%C3%B3n%20del%20Biob%C3%ADo"
```

Deberías ver un JSON con 9 datacenters.

### 2. Ver en consola del navegador:

Abre DevTools (F12) y busca mensajes como:
```
✅ Cargados 9 datacenters de Región del Biobío
🌐 Generando 36 rutas realistas entre datacenters...
  ✅ Ruta Concepción ↔ Talcahuano: 15.23 km
  ✅ Ruta Concepción ↔ Chillán: 108.45 km
  ...
🎉 36 rutas realistas generadas exitosamente
```

### 3. Ver en el mapa:

- Líneas azules siguiendo carreteras
- Indicador en la esquina superior derecha: "🗺️ 9 DCs - 36 rutas"

---

## 🐛 Troubleshooting

### Error: "Cargando datacenters..." indefinido

**Problema:** Backend no responde o URL incorrecta

**Solución:**
```bash
# Verificar que el backend esté corriendo
docker ps | grep backend

# Verificar URL en RealisticFiberLinks.jsx línea ~28
# Debe ser: http://localhost:5000/api/infrastructure/datacenters
```

### Error: "Failed to fetch"

**Problema:** CORS o backend no accesible

**Solución:**
```bash
# Verificar CORS en backend/server.js
# Debe tener: app.use(cors());
```

### Las rutas no aparecen

**Problema:** Servicio OSRM público puede estar lento o con rate limit

**Solución:**
- Espera unos segundos, se generan de forma asíncrona
- Revisa consola del navegador para ver errores específicos
- Considera reducir el número de datacenters temporalmente

### Rutas aparecen pero como líneas rectas

**Problema:** OSRM no encontró ruta por carretera

**Solución:**
- Verifica que las coordenadas estén en Chile
- Algunas ubicaciones remotas pueden no tener conexión vial
- Revisa mensajes de error en consola

---

## 🚀 Próximas Mejoras

1. **Cache de rutas**
   - Guardar rutas generadas en localStorage
   - Evitar regenerar en cada visita

2. **Modo offline**
   - Usar rutas pre-calculadas
   - Fallback a líneas rectas si OSRM falla

3. **Animación de carga**
   - Mostrar progreso de generación de rutas
   - Barra de progreso visual

4. **Filtros avanzados**
   - Mostrar solo rutas > X km
   - Ocultar rutas por empresa
   - Resaltar ruta específica

5. **Información en hover**
   - Tooltip con distancia y duración
   - Empresas conectadas
   - Capacidad del enlace

6. **Exportar rutas**
   - Descargar como GeoJSON
   - Guardar en base de datos
   - Compartir enlace directo

---

## 📁 Archivos Modificados

```
frontend/
├── package.json                          [MODIFICADO] +leaflet-routing-machine
├── src/
│   ├── App.jsx                           [MODIFICADO] +RealisticFiberLinks, +toggle
│   └── components/
│       └── RealisticFiberLinks.jsx       [NUEVO] Componente principal

backend/
└── routes/
    └── infrastructure.js                 [MODIFICADO] +endpoints datacenters
```

---

## 📚 Referencias

- [Leaflet Routing Machine](https://www.lrm.io/)
- [OSRM Public Instance](http://project-osrm.org/)
- [Leaflet Documentation](https://leafletjs.com/)
- [React Leaflet](https://react-leaflet.js.org/)

---

## ✨ ¡Listo para usar!

1. Asegúrate de que el backend esté corriendo
2. Abre el frontend: http://localhost:8080
3. Activa "🗺️ Rutas Realistas (Biobío)" en el sidebar
4. Disfruta de las rutas realistas generadas automáticamente

**No se necesita OSRM local, todo funciona desde el navegador!** 🎉
