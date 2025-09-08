import folium
import json

# Cargar tu archivo .js y extraer el objeto JSON
with open("datos.js", "r", encoding="utf-8") as f:
    contenido = f.read()

# Extraer solo la parte JSON (quitando "var ... =")
inicio = contenido.find("{")
geojson_data = json.loads(contenido[inicio:])

# Crear mapa
m = folium.Map(location=[-39.1, -73.18], zoom_start=12)

# Agregar las geometrías
folium.GeoJson(geojson_data, name="fibra óptica").add_to(m)

# Guardar resultado
m.save("mapa.html")
print("Mapa generado: abre mapa.html en tu navegador")

