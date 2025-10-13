"""Orquestador para extraer amenazas: USGS, APIs de incendios y clima extremo
Requisitos: requests, geopandas
"""
import json
import requests
from pathlib import Path

def extract_all_threats(output_dir='amenazas'):
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Ejemplo: llamar a USGS para sismos recientes
    # (encapsular en get_recent_earthquakes con manejo de errores)
    earthquakes = get_recent_earthquakes()

    out_path = Path(output_dir) / 'earthquakes.geojson'
    with open(out_path, 'w') as f:
        json.dump(earthquakes, f, indent=2)

    print('Amenazas exportadas a', output_dir)

def get_recent_earthquakes():
    """Consulta la API de USGS para obtener sismos recientes en Chile."""
    url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
    params = {
        "format": "geojson",
        "starttime": "2025-09-01",
        "endtime": "2025-10-01",
        "minlatitude": -56,
        "maxlatitude": -17,
        "minlongitude": -75,
        "maxlongitude": -66,
        "minmagnitude": 4.5
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

if __name__ == '__main__':
    extract_all_threats()