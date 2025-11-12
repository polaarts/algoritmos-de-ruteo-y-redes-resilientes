import requests

def obtener_uso_suelo(lat_min, lon_min, lat_max, lon_max):
    """
    Consulta OpenStreetMap vía Overpass API para obtener áreas con 'landuse'
    dentro del bounding box dado.
    Retorna un dict JSON con los elementos.
    """
    overpass_url = "http://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:25];
    (
      way["landuse"]({lat_min},{lon_min},{lat_max},{lon_max});
      relation["landuse"]({lat_min},{lon_min},{lat_max},{lon_max});
    );
    out body;
    >;
    out skel qt;
    """
    response = requests.get(overpass_url, params={'data': query})
    if response.status_code != 200:
        print("Error en la consulta:", response.status_code, response.text)
        return None
    return response.json()

if __name__ == "__main__":
    # Ejemplo: Región del Biobío (bounding box aproximado)
    lat_min, lon_min = -37.5, -73.5
    lat_max, lon_max = -36.5, -72.5
    uso_suelo = obtener_uso_suelo(lat_min, lon_min, lat_max, lon_max)
    if uso_suelo:
        print("Número de áreas encontradas:", len(uso_suelo.get('elements', [])))
        # Mostrar algunos ejemplos
        for e in uso_suelo.get('elements', [])[:5]:
            print("ID:", e.get('id'), "Tags:", e.get('tags'))


