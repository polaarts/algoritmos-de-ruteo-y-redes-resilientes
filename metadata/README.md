# Metadata: Estructura y Descripción

## Archivos Generados

### 1. `datacenters_normalized.geojson`
**Descripción:**
Archivo GeoJSON que contiene la ubicación y atributos normalizados de los datacenters.

**Estructura:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",  // Representa la ubicación del datacenter
        "coordinates": [lon, lat]
      },
      "properties": {
        "id": "string",       // ID único del datacenter
        "name": "string",     // Nombre del datacenter
        "capacity": "number"  // Capacidad estimada (opcional)
      }
    }
  ]
}
```

**Campos:**
- **id**: Identificador único del datacenter.
- **name**: Nombre del datacenter.
- **capacity**: Capacidad estimada (si está disponible).

## Fuente de Datos
- **Datacenters:** Archivo `datacenters_fixed.geojson` proporcionado como entrada.
- **APIs Externas:** Se pueden integrar en futuras versiones para enriquecer los datos.

## Notas
Este archivo fue generado utilizando el script `extract_all_metadata.py`, que consolida y normaliza datos de diferentes fuentes.