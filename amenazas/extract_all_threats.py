"""
Script: integrar_datos.py
Descripción:
    Integra y organiza la información proveniente de tres fuentes:
    - clima_extremo.py      → Condiciones meteorológicas actuales.
    - incendios_forestales.py → Registros recientes de incendios forestales.
    - seismicidad.py        → Eventos sísmicos en Chile durante el periodo consultado.
    
    Todos los scripts se asumen en el mismo directorio.
    Este integrador ejecuta los scripts, extrae los datos y genera un archivo consolidado.
"""

import importlib
import json
import pandas as pd
from datetime import datetime

# Importar los tres módulos (ejecutan sus requests al ser importados)
import clima_extremo
import incendios_forestales
import seismicidad

def obtener_datos_clima():
    """Ejecuta clima_extremo.py y retorna datos relevantes."""
    try:
        import clima_extremo
        # Asumimos que clima_extremo.py imprime pero no devuelve.
        # Podríamos modificar ese script para devolver el dict completo.
        # Si ya lo hace, usar: return clima_extremo.obtener_clima()
        resp = clima_extremo.requests.get(
            clima_extremo.url, params=clima_extremo.params
        ).json()
        data = {
            "temperatura": resp.get("main", {}).get("temp"),
            "humedad": resp.get("main", {}).get("humidity"),
            "presion": resp.get("main", {}).get("pressure"),
            "viento": resp.get("wind", {}).get("speed"),
            "precipitacion_mm": (resp.get("rain") or {}).get("1h", 0),
            "descripcion": resp["weather"][0]["description"] if "weather" in resp else None,
            "ubicacion": resp.get("name"),
            "timestamp": datetime.utcnow().isoformat()
        }
        return data
    except Exception as e:
        print("Error al obtener datos de clima:", e)
        return {}

def obtener_datos_incendios():
    """Ejecuta incendios_forestales.py y retorna lista de incendios."""
    try:
        import incendios_forestales
        resp = incendios_forestales.requests.get(
            incendios_forestales.url, params=incendios_forestales.params
        )
        if resp.status_code == 200:
            data = resp.json().get("features", [])
            # Simplificar
            incendios = [
                {
                    "region": f["properties"]["region"],
                    "comuna": f["properties"]["comuna"],
                    "nombre": f["properties"]["nom_incen"],
                    "superficie_ha": f["properties"]["superficie"],
                    "causa": f["properties"]["causa_gene"],
                    "temporada": f["properties"]["temporada"],
                    "lat": f["geometry"]["coordinates"][1],
                    "lon": f["geometry"]["coordinates"][0],
                }
                for f in data
            ]
            return incendios
        else:
            print("Error al consultar incendios:", resp.status_code)
            return []
    except Exception as e:
        print("Error al obtener incendios:", e)
        return []

def obtener_datos_sismos():
    """Ejecuta seismicidad.py y retorna lista de eventos sísmicos."""
    try:
        import seismicidad
        resp = seismicidad.requests.get(
            seismicidad.url, params=seismicidad.params
        ).json()
        sismos = [
            {
                "magnitud": f["properties"]["mag"],
                "ubicacion": f["properties"]["place"],
                "fecha": datetime.utcfromtimestamp(f["properties"]["time"]/1000).isoformat(),
                "url": f["properties"]["url"],
                "lat": f["geometry"]["coordinates"][1],
                "lon": f["geometry"]["coordinates"][0]
            }
            for f in resp.get("features", [])
        ]
        return sismos
    except Exception as e:
        print("Error al obtener datos de sismos:", e)
        return []

def main():
    print("Extrayendo datos de clima, incendios y sismos...")

    clima = obtener_datos_clima()
    incendios = obtener_datos_incendios()
    sismos = obtener_datos_sismos()

    resultado = {
        "clima_extremo": clima,
        "incendios_forestales": incendios,
        "sismicidad": sismos,
        "ultima_actualizacion": datetime.utcnow().isoformat()
    }

    # Guardar todo en JSON
    with open("datos_integrados.json", "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=4)

    # Crear DataFrames (opcional)
    df_incendios = pd.DataFrame(incendios)
    df_sismos = pd.DataFrame(sismos)
    df_clima = pd.DataFrame([clima])

    # Exportar también a CSV para análisis
    df_clima.to_csv("clima_extremo.csv", index=False)
    df_incendios.to_csv("incendios_forestales.csv", index=False)
    df_sismos.to_csv("sismicidad.csv", index=False)

    print("Datos integrados correctamente en 'datos_integrados.json' y CSVs individuales.")

if __name__ == "__main__":
    main()

