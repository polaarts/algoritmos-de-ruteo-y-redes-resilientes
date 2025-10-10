import osmnx as ox
import geopandas as gpd

# Definir área de interés (por nombre o bounding box)
place = "Santiago, Chile"
G = ox.graph_from_place(place, network_type='drive')
gdf_edges = ox.graph_to_gdfs(G, nodes=False, edges=True)

def estimar_recubrimiento(highway, surface=None):
    """
    Función heurística simple para asignar tipo de recubrimiento estimado
    basado en la clase de vía (highway) y, opcionalmente, en superficie.
    """
    # si highway es una lista, tomar el primer elemento
    hw = highway[0] if isinstance(highway, list) else highway

    # autopistas / rutas principales → necesidad más robusta
    if hw in ("motorway", "trunk", "primary"):
        return "armored / PE exterior"

    # vías secundarias / terciarias → recubrimiento robusto o reforzado
    if hw in ("secondary", "tertiary"):
        return "outdoor robust (PE o con armadura parcial)"

    # calles locales / vías urbanas
    if hw in ("residential", "unclassified", "service"):
        # si la superficie es no pavimentada, usar recubrimiento más resistente
        if surface in ("unpaved", "dirt", "gravel"):
            return "armored / robust"
        else:
            return "LSZH / interior / estándar"

    # fallback si no coincide
    return "LSZH / estándar"

# Aplicar la estimación al GeoDataFrame
gdf_edges["recubrimiento_estim"] = gdf_edges.apply(
    lambda row: estimar_recubrimiento(row["highway"], row.get("surface")), axis=1
)

# Exportar o visualizar
gdf_edges.to_file("vias_con_recubrimiento_estim.geojson", driver="GeoJSON")
print("Exportado con recubrimientos estimados.")

