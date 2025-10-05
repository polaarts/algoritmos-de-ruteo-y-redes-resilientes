import requests
import json

def obtener_vias_osm(lat_min, lon_min, lat_max, lon_max):
    """
    Consulta OpenStreetMap vía Overpass API para obtener vías en el bounding box con tags.
    Retorna un GeoJSON-like dict con las vías y sus propiedades.
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    # Query OSM Overpass QL para formas de vías (way) con tag highway dentro del bbox
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({lat_min},{lon_min},{lat_max},{lon_max});
    );
    out body;
    >;
    out skel qt;
    """
    response = requests.get(overpass_url, params={'data': query})
    data = response.json()
    return data

if __name__ == "__main__":
    # Ejemplo: bounding box aproximado Biobío (puedes ajustarlo)
    lat_min, lon_min = -37.5, -73.5
    lat_max, lon_max = -36.5, -72.5
    vias = obtener_vias_osm(lat_min, lon_min, lat_max, lon_max)
    print("Número de vías encontradas:", len(vias.get('elements', [])))
    # Mostrar algunas vías con tags
    for e in vias.get('elements', [])[:5]:
        print(e.get('id'), e.get('tags'))

