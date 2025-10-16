"""
Script: integrar_datos_infraestructura_v2.py
Descripción:
    Ejecuta y organiza los resultados de tres módulos independientes:
    - ground_type.py               → uso o tipo de suelo
    - infraestructure_support.py   → infraestructura de soporte (vías)
    - recubrimiento_estimado.py    → estimación de recubrimiento del tendido
    
    Este script ejecuta cada programa en orden, captura los datos resultantes (JSON / GeoJSON),
    y crea un archivo final con toda la metadata consolidada.

Requisitos:
    - Los tres scripts deben estar en el mismo directorio.
    - `recubrimiento_estimado.py` genera el archivo 'vias_con_recubrimiento_estim.geojson'.
    - Se requiere tener instalados: requests, geopandas, pandas, osmnx.
"""

import subprocess
import json
import geopandas as gpd
import os
from datetime import datetime

def ejecutar_script(nombre_script):
    """Ejecuta un script Python y captura su salida de consola."""
    print(f"▶ Ejecutando {nombre_script}...")
    try:
        resultado = subprocess.run(
            ["python", nombre_script],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"✅ {nombre_script} ejecutado correctamente.")
        return resultado.stdout
    except subprocess.CalledProcessError as e:
        print(f"❌ Error al ejecutar {nombre_script}: {e}")
        print(e.stdout)
        print(e.stderr)
        return None


def obtener_datos_ground_type():
    """Ejecuta ground_type.py y extrae el JSON directamente de la API."""
    import ground_type
    lat_min, lon_min = -37.5, -73.5
    lat_max, lon_max = -36.5, -72.5
    data = ground_type.obtener_uso_suelo(lat_min, lon_min, lat_max, lon_max)
    if data:
        print(f"🌱 Áreas de uso de suelo extraídas: {len(data.get('elements', []))}")
    return data


def obtener_datos_infraestructura():
    """Ejecuta infraestructure_support.py y extrae el JSON directamente."""
    import infraestructure_support
    lat_min, lon_min = -37.5, -73.5
    lat_max, lon_max = -36.5, -72.5
    data = infraestructure_support.obtener_vias_osm(lat_min, lon_min, lat_max, lon_max)
    print(f"🛣️  Vías extraídas: {len(data.get('elements', []))}")
    return data


def obtener_datos_recubrimiento():
    """Ejecuta recubrimiento_estimado.py (que genera el GeoJSON) y lo carga."""
    ejecutar_script("recubrimiento_estimado.py")

    geojson_path = "vias_con_recubrimiento_estim.geojson"
    if os.path.exists(geojson_path):
        gdf = gpd.read_file(geojson_path)
        print(f"📦 Vías con recubrimiento estimado: {len(gdf)}")
        return json.loads(gdf.to_json())
    else:
        print("⚠️ No se encontró el archivo 'vias_con_recubrimiento_estim.geojson'")
        return None


def main():
    print("🚀 Iniciando integración de datos de infraestructura...")

    # Ejecutar los scripts e integrar los resultados
    datos_suelo = obtener_datos_ground_type()
    datos_vias = obtener_datos_infraestructura()
    datos_recubrimiento = obtener_datos_recubrimiento()

    # Estructura consolidada
    metadata_final = {
        "fuente": "Integración automática de APIs y OSM",
        "fecha_generacion": datetime.utcnow().isoformat(),
        "resumen": {
            "n_areas_suelo": len(datos_suelo.get("elements", [])) if datos_suelo else 0,
            "n_vias": len(datos_vias.get("elements", [])) if datos_vias else 0,
            "n_vias_recubrimiento": len(datos_recubrimiento["features"]) if datos_recubrimiento else 0,
        },
        "uso_suelo": datos_suelo,
        "infraestructura": datos_vias,
        "recubrimiento_estimado": datos_recubrimiento
    }

    # Guardar todo en un solo archivo JSON
    salida = "metadata_infraestructura_final.json"
    with open(salida, "w", encoding="utf-8") as f:
        json.dump(metadata_final, f, ensure_ascii=False, indent=4)

    print(f"\n✅ Archivo final generado: {salida}")
    print("📊 Contiene todos los datos de suelo, vías y recubrimiento estimado.")


if __name__ == "__main__":
    main()


