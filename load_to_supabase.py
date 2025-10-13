import json
import requests
from typing import List, Dict
import time

class SupabaseGeoLoader:
    def __init__(self, url: str, key: str):
        self.url = url
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
    
    @staticmethod
    def force_2d_coords(coords):
        """Fuerza coordenadas a 2D (elimina Z si existe)"""
        if isinstance(coords[0], (list, tuple)):
            # Es un array de coordenadas (LineString, Polygon)
            return [[c[0], c[1]] for c in coords]
        else:
            # Es una coordenada simple (Point)
            return [coords[0], coords[1]]
    
    @staticmethod
    def geojson_to_wkt(geom_dict: dict, force_2d: bool = True) -> str:
        """Convierte GeoJSON a WKT para PostGIS"""
        geom_type = geom_dict['type']
        coords = geom_dict['coordinates']
        
        if force_2d:
            if geom_type == 'Point':
                coords = coords[:2]  # Solo X, Y
                return f"SRID=4326;POINT({coords[0]} {coords[1]})"
            
            elif geom_type == 'LineString':
                coords_2d = [f"{c[0]} {c[1]}" for c in coords]
                return f"SRID=4326;LINESTRING({','.join(coords_2d)})"
            
            elif geom_type == 'Polygon':
                rings = []
                for ring in coords:
                    coords_2d = [f"{c[0]} {c[1]}" for c in ring]
                    rings.append(f"({','.join(coords_2d)})")
                return f"SRID=4326;POLYGON({','.join(rings)})"
        
        return None
    
    def load_from_geojson(self, geojson_path: str):
        """Carga datos desde GeoJSON"""
        print(f"\n📂 Leyendo {geojson_path}...")
        
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        nodes = []
        edges = []
        
        for feature in data.get('features', []):
            geom_type = feature['geometry']['type']
            
            if geom_type == 'Point':
                node = self._parse_node(feature)
                if node:
                    nodes.append(node)
            
            elif geom_type == 'LineString':
                edge = self._parse_edge(feature)
                if edge:
                    edges.append(edge)
        
        print(f"✓ Parseados: {len(nodes)} nodes, {len(edges)} edges")
        
        if nodes:
            print("\n📤 Cargando nodes...")
            self._insert_batch('nodes', nodes)
        
        if edges:
            print("\n📤 Cargando edges...")
            self._insert_batch('edges', edges)
    
    def _parse_node(self, feature: dict) -> dict:
        """Parsea un Point a formato de nodes"""
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        
        # Forzar 2D
        lon, lat = coords[0], coords[1]
        elevation = coords[2] if len(coords) > 2 else props.get('elevation')
        
        node = {
            'osm_id': props.get('osm_id'),
            'node_type': props.get('type') or props.get('node_type') or 'intersection',
            'latitude': lat,
            'longitude': lon,
            'region': props.get('region'),
            'city': props.get('city'),
            'elevation': elevation,
            # Crear geometría WKT 2D
            'geometry': f"SRID=4326;POINT({lon} {lat})"
        }
        
        return {k: v for k, v in node.items() if v is not None}
    
    def _parse_edge(self, feature: dict) -> dict:
        """Parsea un LineString a formato de edges"""
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        
        # Forzar 2D y crear WKT
        coords_2d = [f"{c[0]} {c[1]}" for c in coords]
        wkt = f"SRID=4326;LINESTRING({','.join(coords_2d)})"
        
        # Calcular longitud aproximada si no existe
        length = props.get('length')
        if not length:
            # Aproximación simple (en grados, no exacta)
            length = sum([
                ((coords[i+1][0] - coords[i][0])**2 + 
                 (coords[i+1][1] - coords[i][1])**2)**0.5
                for i in range(len(coords)-1)
            ]) * 111000  # Convertir grados a metros (aproximado)
        
        edge = {
            'osm_id': str(props.get('osm_id')) if props.get('osm_id') else None,
            'geometry': wkt,
            'length': length,
            'highway': props.get('highway'),
            'name': props.get('name'),
            'surface': props.get('surface'),
            'lanes': props.get('lanes'),
            'maxspeed': props.get('maxspeed'),
            'oneway': bool(props.get('oneway', False)),
            'bridge': bool(props.get('bridge', False)),
            'tunnel': bool(props.get('tunnel', False)),
            'region': props.get('region'),
            'source_type': props.get('source_type'),
            'link_type': props.get('link_type'),
            'recubrimiento_estim': props.get('recubrimiento_estim'),
        }
        
        return {k: v for k, v in edge.items() if v is not None}
    
    def load_datacenters(self, geojson_path: str):
        """Carga datacenters desde GeoJSON"""
        print(f"\n📂 Leyendo {geojson_path}...")
        
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        datacenters = []
        for feature in data.get('features', []):
            props = feature['properties']
            coords = feature['geometry']['coordinates']
            
            # Forzar 2D
            lon, lat = coords[0], coords[1]
            
            dc = {
                'name': props.get('name'),
                'company_name': props.get('company_name') or props.get('company'),
                'address': props.get('address'),
                'city': props.get('city'),
                'state': props.get('state') or props.get('region'),
                'country': props.get('country', 'Chile'),
                'capacity_mw': props.get('capacity_mw'),
                'tier_level': props.get('tier_level'),
                'year_opened': props.get('year_opened'),
                'urban_density': props.get('urban_density'),
                'population_5km': props.get('population_5km'),
                # Geometría WKT 2D
                'geometry': f"SRID=4326;POINT({lon} {lat})"
            }
            
            datacenters.append({k: v for k, v in dc.items() if v is not None})
        
        print(f"✓ Parseados: {len(datacenters)} datacenters")
        
        if datacenters:
            print("\n📤 Cargando datacenters...")
            self._insert_batch('datacenters', datacenters)
    
    def load_threats(self, geojson_path: str, threat_type: str):
        """Carga amenazas desde GeoJSON"""
        print(f"\n📂 Leyendo {geojson_path}...")
        
        with open(geojson_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        threats = []
        for feature in data.get('features', []):
            props = feature['properties']
            geom = feature['geometry']
            
            # Manejar diferentes tipos de geometría
            if geom['type'] == 'Point':
                coords = geom['coordinates']
                lon, lat = coords[0], coords[1]
                wkt = f"SRID=4326;POINT({lon} {lat})"
            elif geom['type'] == 'Polygon':
                coords = geom['coordinates']
                rings = []
                for ring in coords:
                    coords_2d = [f"{c[0]} {c[1]}" for c in ring]
                    rings.append(f"({','.join(coords_2d)})")
                wkt = f"SRID=4326;POLYGON({','.join(rings)})"
            elif geom['type'] == 'LineString':
                coords = geom['coordinates']
                coords_2d = [f"{c[0]} {c[1]}" for c in coords]
                wkt = f"SRID=4326;LINESTRING({','.join(coords_2d)})"
            else:
                continue
            
            threat = {
                'threat_type': threat_type,
                'magnitude': props.get('magnitude') or props.get('mag'),
                'depth': props.get('depth'),
                'event_date': props.get('event_date') or props.get('time') or props.get('date'),
                'location': props.get('location') or props.get('place'),
                'severity': props.get('severity'),
                'affected_area_km2': props.get('affected_area_km2'),
                'description': props.get('description') or props.get('title'),
                'source': props.get('source'),
                'properties': json.dumps(props),  # Guardar todas las propiedades como JSON
                'geometry': wkt
            }
            
            threats.append({k: v for k, v in threat.items() if v is not None})
        
        print(f"✓ Parseados: {len(threats)} {threat_type} threats")
        
        if threats:
            print(f"\n📤 Cargando {threat_type} threats...")
            self._insert_batch('threats', threats)
    
    def _insert_batch(self, table: str, data: List[Dict], batch_size: int = 100):
        """Inserta datos en lotes"""
        total = len(data)
        success = 0
        
        for i in range(0, total, batch_size):
            batch = data[i:i+batch_size]
            
            try:
                response = requests.post(
                    f"{self.url}/rest/v1/{table}",
                    headers=self.headers,
                    json=batch,
                    timeout=60
                )
                
                if response.status_code in [200, 201]:
                    success += len(batch)
                    print(f"  ✓ {success}/{total} registros")
                else:
                    print(f"  ✗ Error: {response.status_code}")
                    print(f"     {response.text[:200]}")
                    
            except Exception as e:
                print(f"  ✗ Excepción: {str(e)}")
            
            time.sleep(0.3)
        
        print(f"\n{'='*60}")
        print(f"📊 {table}: {success}/{total} exitosos")
        return success

# USO
if __name__ == "__main__":
    loader = SupabaseGeoLoader(
        url="https://klqxckzqovjtazjifnlu.supabase.co",
        key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtscXhja3pxb3ZqdGF6amlmbmx1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDI5MzcxOSwiZXhwIjoyMDc1ODY5NzE5fQ.X3CcXaeaEcK8WIfJWjs_5A_abzXrwGXaA1dTUcwfIwg"  # Usar SERVICE_ROLE key
    )
    
    print("="*60)
    print("🚀 CARGA DE DATOS A SUPABASE")
    print("="*60)
    
    # Cargar infraestructura (nodes y edges)
    print("\n📍 1. INFRAESTRUCTURA")
    loader.load_from_geojson('infraestructura/mapa_completo_v2.geojson')
    
    # Cargar datacenters
    print("\n🏢 2. DATACENTERS")
    loader.load_datacenters('metadata/datacenters_normalized.geojson')
    
    # Cargar amenazas
    print("\n⚠️  3. AMENAZAS")
    
    # Terremotos
    print("\n  🌍 Terremotos")
    loader.load_threats('amenazas/earthquakes.geojson', 'earthquake')
    
    # Incendios forestales (si existe)
    try:
        print("\n  🔥 Incendios Forestales")
        loader.load_threats('amenazas/forest_fires.geojson', 'forest_fire')
    except FileNotFoundError:
        print("  ⚠️  Archivo de incendios no encontrado, saltando...")
    
    # Clima extremo (si existe)
    try:
        print("\n  🌪️  Clima Extremo")
        loader.load_threats('amenazas/extreme_weather.geojson', 'extreme_weather')
    except FileNotFoundError:
        print("  ⚠️  Archivo de clima extremo no encontrado, saltando...")
    
    print("\n" + "="*60)
    print("✅ PROCESO COMPLETADO")
    print("="*60)