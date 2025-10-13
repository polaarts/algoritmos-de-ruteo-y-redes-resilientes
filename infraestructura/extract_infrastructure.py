"""Extracción de la red vial con OSMnx y exportación a GeoJSON
Requisitos: osmnx, geopandas
"""
import os
import osmnx as ox
import geopandas as gpd

def extract_infrastructure(output_dir='infraestructura'):
    os.makedirs(output_dir, exist_ok=True)

    # Definir las regiones de interés (La Serena a Puerto Montt)
    regions = [
        "La Serena, Chile",
        "Coquimbo, Chile",
        "Valparaíso, Chile",
        "Santiago, Chile",
        "Rancagua, Chile",
        "Talca, Chile",
        "Concepción, Chile",
        "Temuco, Chile",
        "Puerto Montt, Chile"
    ]

    # Descargar y combinar grafos de las regiones
    graphs = []
    for region in regions:
        print(f"Descargando datos para: {region}")
        G = ox.graph_from_place(region, network_type='all')
        graphs.append(G)

    # Combinar todos los grafos en uno
    G_combined = ox.utils_graph.graphs_to_gdfs(graphs, nodes=True, edges=True)

    # Convertir a GeoDataFrames
    nodes_gdf, edges_gdf = ox.graph_to_gdfs(G_combined, nodes=True, edges=True)

    # Calcular longitud si no existe
    if 'length' not in edges_gdf.columns:
        edges_gdf['length'] = edges_gdf.geometry.length

    nodes_out = os.path.join(output_dir, 'nodes.geojson')
    edges_out = os.path.join(output_dir, 'edges.geojson')

    nodes_gdf.to_file(nodes_out, driver='GeoJSON')
    edges_gdf.to_file(edges_out, driver='GeoJSON')

    print(f"Guardado: {nodes_out} ({len(nodes_gdf)} nodos)")
    print(f"Guardado: {edges_out} ({len(edges_gdf)} aristas)")

if __name__ == '__main__':
    extract_infrastructure()