import requests
import datetime

# Coordenadas aproximadas de Concepción (Región del Biobío)
latitude = -36.82699
longitude = -73.04977

# Rango de fechas (últimos 7 días)
end_date = datetime.date.today()
start_date = end_date - datetime.timedelta(days=7)

url = "https://api.open-meteo.com/v1/forecast"

params = {
    "latitude": latitude,
    "longitude": longitude,
    "start_date": start_date.isoformat(),
    "end_date": end_date.isoformat(),
    "daily": ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
    "timezone": "America/Santiago"
}

response = requests.get(url, params=params)
data = response.json()

print("Temperaturas y precipitaciones recientes en Concepción:")
for i, date in enumerate(data["daily"]["time"]):
    temp_max = data["daily"]["temperature_2m_max"][i]
    temp_min = data["daily"]["temperature_2m_min"][i]
    precip = data["daily"]["precipitation_sum"][i]
    print(f"{date} -> Máx: {temp_max}°C, Mín: {temp_min}°C, Lluvia: {precip} mm")

