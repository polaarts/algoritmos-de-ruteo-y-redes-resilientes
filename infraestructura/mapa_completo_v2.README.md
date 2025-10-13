# Estructura de mapa_completo_v2.geojson

## Tipo de archivo
GeoJSON FeatureCollection

## Estructura
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "LineString",  // Representa enlaces de fibra
        "coordinates": [[lon, lat], ...]
      },
      "properties": {
        "id": "string",           // ID único del enlace
        "source": "number",       // Nodo origen
        "target": "number",       // Nodo destino
        "length": "number",       // Longitud en metros
        "highway": "string",      // Tipo de vía (motorway, primary, etc.)
        "surface": "string"       // Tipo de superficie (paved, unpaved, etc.)
      }
    }
  ]
}
```

## Descripción de campos
- **id**: Identificador único del enlace de red
- **source/target**: IDs de nodos que conecta este enlace
- **length**: Distancia física del enlace en metros
- **highway**: Clasificación OSM de la vía (afecta tipo de recubrimiento de fibra)
- **surface**: Estado del pavimento (afecta dificultad de instalación)

## Fuente de datos
OpenStreetMap vía OSMnx - Red vial de Chile

## Notas adicionales
Este archivo fue generado utilizando el script `extract_infrastructure.py`, que extrae nodos y aristas desde OpenStreetMap y calcula atributos relevantes como la longitud de los enlaces.