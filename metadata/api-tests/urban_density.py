import requests
import time
import json

def get_worldpop_stats_for_region(region_geojson, year=2020, dataset="wpgppop", api_key=None, sleep_between_checks=5):
    """
    Consulta WorldPop stats para la región indicada.
    Retorna los datos una vez completado el task o None si hay error.
    region_geojson debe ser un objeto tipo GeoJSON FeatureCollection / Polygon que delimite la región.
    """

    base_url = "https://api.worldpop.org/v1/services/stats"
    params = {
        "dataset": dataset,
        "year": year,
        "geojson": json.dumps(region_geojson),
    }
    if api_key:
        params["key"] = api_key

    resp = requests.get(base_url, params=params)
    if resp.status_code != 200:
        print(f"Error inicial al solicitar stats: {resp.status_code} — {resp.text}")
        return None

    resp_json = resp.json()
    # Si la respuesta contiene un taskid, hay que monitorear
    if "taskid" in resp_json:
        taskid = resp_json["taskid"]
        print(f"Task creado con ID: {taskid}. Esperando resultado...")
        # Ahora revisamos hasta que termine
        task_url = f"https://api.worldpop.org/v1/tasks/{taskid}"
        while True:
            time.sleep(sleep_between_checks)
            task_resp = requests.get(task_url)
            if task_resp.status_code != 200:
                print(f"Error al consultar task status: {task_resp.status_code} — {task_resp.text}")
                return None
            task_json = task_resp.json()
            status = task_json.get("status")
            print(f"Estado del task: {status}")
            if status == "finished":
                return task_json.get("data")
            elif status in ("failed", "error"):
                print("El task falló.")
                return None
            # si es "created" u otro estado aún pendiente, seguimos esperando

    else:
        # respuesta inmediata ( quizá para regiones pequeñas ) — retorna data
        return resp_json.get("data")

if __name__ == "__main__":
    # GeoJSON simplificado para la Región del Biobío
    region_biobio = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-73.7, -38.5],
                            [-72.0, -38.5],
                            [-72.0, -36.5],
                            [-73.7, -36.5],
                            [-73.7, -38.5]
                        ]
                    ]
                }
            }
        ]
    }

    data = get_worldpop_stats_for_region(region_biobio, year=2020)
    if data:
        print("Datos obtenidos para Biobío:", data)
    else:
        print("No se obtuvieron datos para Biobío.")

    # De la misma forma se puede hacer para La Araucanía cambiando el GeoJSON
    region_araucania = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-73.0, -40.5],
                            [-71.3, -40.5],
                            [-71.3, -38.5],
                            [-73.0, -38.5],
                            [-73.0, -40.5]
                        ]
                    ]
                }
            }
        ]
    }

    data2 = get_worldpop_stats_for_region(region_araucania, year=2020)
    if data2:
        print("Datos obtenidos para La Araucanía:", data2)
    else:
        print("No se obtuvieron datos para La Araucanía.")

