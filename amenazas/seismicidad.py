import requests

url = "https://earthquake.usgs.gov/fdsnws/event/1/query"
params = {
    "format": "geojson",
    "starttime": "2023-09-01",
    "endtime": "2023-10-01",
    "minlatitude": -56,
    "maxlatitude": -17,
    "minlongitude": -75,
    "maxlongitude": -66
}
resp = requests.get(url, params=params).json()
print("Sismos encontrados:", len(resp['features']))
print("Ejemplo:", resp['features'][0]['properties'])

