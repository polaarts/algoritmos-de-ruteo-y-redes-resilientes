import requests

# Endpoint del servicio MapServer que contiene incendios forestales
url = "https://esri.ciren.cl/server/rest/services/IDEMINAGRI/INCENDIOS/MapServer/5/query"

params = {
    "where": "1=1",           # todas las incidencias
    "outFields": "*",         # todos los atributos
    "geometryType": "esriGeometryEnvelope", 
    "outSR": "4326",           # sistema de referencia lat/lon
    "f": "geojson"             # formato de salida
}

resp = requests.get(url, params=params)
if resp.status_code == 200:
    data = resp.json()
    features = data.get("features", [])
    print(f"Número de incendios forestales retornados: {len(features)}")
    if features:
        print("Ejemplo de incendio:", features[0])
else:
    print("Error al consultar incendios:", resp.status_code, resp.text)

