import requests

api_key = "6564d5596f2d8d146ed67131d6853247"  # obtener en openweathermap.org
lat, lon = -36.82, -73.05  # Ejemplo: Concepción, Biobío

url = f"https://api.openweathermap.org/data/2.5/weather"
params = {
    "lat": lat,
    "lon": lon,
    "appid": api_key,
    "units": "metric"
}

resp = requests.get(url, params=params).json()
print("Condiciones actuales:", resp)
print("Precipitaciones (si existen):", resp.get("rain"))

