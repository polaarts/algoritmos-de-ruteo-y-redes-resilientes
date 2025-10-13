"""Orquestador para extraer metadata (WorldPop, ground types, datacenters)
Requisitos: requests, geopandas
"""
import json
from pathlib import Path

def extract_all_metadata(output_dir='metadata'):
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    # Ejemplo: leer datacenters ya existentes
    # Si hay APIs externas, encapsular en funciones y manejarlas con retries
    with open(Path(output_dir) / 'datacenters_fixed.geojson') as f:
        datacenters = json.load(f)

    # Normalizar y exportar
    with open(Path(output_dir) / 'datacenters_normalized.geojson', 'w') as f:
        json.dump(datacenters, f, indent=2)

    print('Metadata consolidada en', output_dir)

if __name__ == '__main__':
    extract_all_metadata()