# Amenazas: Estructura y Descripción

## Archivos Generados

### 1. `earthquakes.geojson`
**Descripción:**
Archivo GeoJSON que contiene información sobre sismos recientes en Chile.

**Estructura:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",  // Representa la ubicación del sismo
        "coordinates": [lon, lat]
      },
      "properties": {
        "magnitude": "number",  // Magnitud del sismo
        "depth": "number",      // Profundidad en km
        "time": "string",       // Timestamp ISO 8601
        "place": "string"       // Descripción de la ubicación
      }
    }
  ]
}
```

**Campos:**
- **magnitude**: Magnitud del sismo en la escala de Richter.
- **depth**: Profundidad del sismo en kilómetros.
- **time**: Fecha y hora del evento en formato ISO 8601.
- **place**: Descripción de la ubicación del sismo.

## Fuente de Datos
- **Sismos:** USGS Earthquake API.
- **Incendios y Clima Extremo:** Se pueden integrar en futuras versiones.

## Notas
Este archivo fue generado utilizando el script `extract_all_threats.py`, que consolida datos de diferentes fuentes de amenazas.