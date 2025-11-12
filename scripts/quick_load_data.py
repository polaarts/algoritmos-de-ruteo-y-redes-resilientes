#!/usr/bin/env python3
"""
Script simplificado para cargar datos GeoJSON locales a PostgreSQL/Supabase
"""
import json
import psycopg2
from psycopg2.extras import execute_batch
import os
from dotenv import load_dotenv

# Cargar variables de entorno desde backend/.env
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(env_path)

# Configuración de la base de datos (desde .env o valores por defecto)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

print(f"🔧 Configuración de base de datos:")
print(f"   Host: {DB_CONFIG['host']}")
print(f"   Puerto: {DB_CONFIG['port']}")
print(f"   Base de datos: {DB_CONFIG['database']}")
print(f"   Usuario: {DB_CONFIG['user']}")

def connect_db():
    """Conecta a la base de datos"""
    conn = psycopg2.connect(**DB_CONFIG)
    print("✅ Conectado a PostgreSQL")
    return conn

def load_infrastructure(conn, filepath):
    """Carga infraestructura de red desde GeoJSON a fiber_links"""
    print(f"\n📂 Cargando infraestructura desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"📊 Encontradas {len(features)} features")
    
    cur = conn.cursor()
    
    # Primero, crear nodos desde las geometrías
    print("📍 Extrayendo nodos de las geometrías...")
    node_coords = set()
    for feature in features:
        geom = feature['geometry']
        if geom['type'] == 'LineString':
            coords = geom['coordinates']
            # Primer y último punto
            node_coords.add((coords[0][0], coords[0][1]))
            node_coords.add((coords[-1][0], coords[-1][1]))
    
    print(f"📍 Encontrados {len(node_coords)} nodos únicos")
    
    # Insertar nodos
    node_map = {}  # (lon, lat) -> node_id
    for idx, (lon, lat) in enumerate(node_coords):
        try:
            cur.execute("""
                INSERT INTO fiber_nodes (
                    osm_id, node_type, latitude, longitude, geometry
                ) VALUES (
                    %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)
                )
                RETURNING id
            """, (
                1000000 + idx,  # osm_id como número (BIGINT)
                'intersection',
                lat,
                lon,
                lon,
                lat
            ))
            node_id = cur.fetchone()[0]
            node_map[(lon, lat)] = node_id
            
            if (idx + 1) % 500 == 0:
                conn.commit()
                print(f"  ✓ Insertados {idx + 1} / {len(node_coords)} nodos...")
        except Exception as e:
            print(f"⚠️  Error insertando nodo {idx}: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    print(f"✅ Nodos insertados: {len(node_map)}")
    
    # Insertar enlaces (fiber_links)
    inserted = 0
    for idx, feature in enumerate(features):
        try:
            props = feature.get('properties', {})
            geom = feature['geometry']
            
            if geom['type'] != 'LineString':
                continue
            
            coords = geom['coordinates']
            start_coord = (coords[0][0], coords[0][1])
            end_coord = (coords[-1][0], coords[-1][1])
            
            source_id = node_map.get(start_coord)
            target_id = node_map.get(end_coord)
            
            if not source_id or not target_id:
                continue
            
            # Convertir geometry a GeoJSON string
            geom_json = json.dumps(geom)
            
            # Insertar enlace
            cur.execute("""
                INSERT INTO fiber_links (
                    source, target, osm_id, geometry, highway, surface, 
                    length, name, region
                ) VALUES (
                    %s, %s, %s, ST_GeomFromGeoJSON(%s), %s, %s, 
                    ST_Length(ST_GeomFromGeoJSON(%s)::geography), %s, %s
                )
                ON CONFLICT DO NOTHING
            """, (
                source_id,
                target_id,
                props.get('@id', f'synthetic_{idx}'),
                geom_json,
                props.get('highway', 'unclassified'),
                props.get('surface', 'unknown'),
                geom_json,
                props.get('name', 'Unnamed'),
                props.get('region', 'Chile')
            ))
            
            if cur.rowcount > 0:
                inserted += 1
                
            if (idx + 1) % 100 == 0:
                conn.commit()
                print(f"  ✓ Procesados {idx + 1} / {len(features)} enlaces...")
                
        except Exception as e:
            print(f"⚠️  Error en enlace {idx}: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    cur.close()
    
    print(f"✅ Infraestructura cargada: {inserted} enlaces insertados")
    return inserted

def load_earthquakes(conn, filepath):
    """Carga sismos desde GeoJSON"""
    print(f"\n📂 Cargando sismos desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"📊 Encontrados {len(features)} sismos")
    
    cur = conn.cursor()
    
    inserted = 0
    for idx, feature in enumerate(features):
        try:
            props = feature.get('properties', {})
            geom = feature['geometry']
            # Eliminar dimensión Z si existe
            if geom.get('type') == 'Point' and len(geom.get('coordinates', [])) == 3:
                geom['coordinates'] = geom['coordinates'][:2]  # Solo lon, lat
            
            geom_json = json.dumps(geom)
            
            # Convertir timestamp de Unix epoch a timestamp PostgreSQL
            time_value = props.get('time')
            if time_value:
                # Si es un timestamp en milisegundos (Unix epoch)
                try:
                    from datetime import datetime
                    timestamp = datetime.fromtimestamp(int(time_value) / 1000.0)
                    time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                except:
                    time_str = None
            else:
                time_str = None
            
            cur.execute("""
                INSERT INTO earthquakes (
                    usgs_id, geometry, magnitude, depth, 
                    time, place, threat_level
                ) VALUES (
                    %s, ST_GeomFromGeoJSON(%s), %s, %s, 
                    %s, %s, %s
                )
                ON CONFLICT DO NOTHING
            """, (
                props.get('id', f'eq_{idx}'),
                geom_json,
                props.get('mag', 5.0),
                props.get('depth', 10.0),
                time_str,
                props.get('place', 'Chile'),
                'medium'
            ))
            
            if cur.rowcount > 0:
                inserted += 1
                
        except Exception as e:
            print(f"⚠️  Error en sismo {idx}: {e}")
            conn.rollback()
            continue
    
    conn.commit()
    cur.close()
    
    print(f"✅ Sismos cargados: {inserted} registros insertados")
    return inserted

def create_sample_threats(conn):
    """Crea datos de ejemplo para amenazas faltantes"""
    print("\n📂 Creando datos de ejemplo para amenazas...")
    
    cur = conn.cursor()
    
    # Crear zonas de incendio de ejemplo (sur de Chile)
    try:
        cur.execute("""
            INSERT INTO fire_risk_zones (
                zone_name, geometry, risk_level, last_fire_date, area_km2
            ) VALUES
            ('Región del Biobío - Alta', 
             ST_Buffer(ST_MakePoint(-72.5, -37.0)::geography, 50000)::geometry,
             'high', CURRENT_DATE, 5000),
            ('Región de la Araucanía - Extrema', 
             ST_Buffer(ST_MakePoint(-72.0, -38.5)::geography, 30000)::geometry,
             'extreme', CURRENT_DATE, 3000),
            ('Región de Los Ríos - Media', 
             ST_Buffer(ST_MakePoint(-72.5, -39.8)::geography, 40000)::geometry,
             'medium', CURRENT_DATE, 4000)
            ON CONFLICT DO NOTHING
        """)
        conn.commit()
        print("✅ Zonas de incendio de ejemplo creadas")
    except Exception as e:
        print(f"⚠️  Error creando zonas de incendio: {e}")
        conn.rollback()
    
    # Crear eventos climáticos de ejemplo
    try:
        cur.execute("""
            INSERT INTO weather_events (
                event_type, geometry, severity, event_date, description
            ) VALUES
            ('storm', 
             ST_Buffer(ST_MakePoint(-70.6, -33.5)::geography, 20000)::geometry,
             'high', CURRENT_DATE - INTERVAL '2 days', 
             'Tormenta eléctrica severa'),
            ('flood', 
             ST_Buffer(ST_MakePoint(-71.5, -35.0)::geography, 25000)::geometry,
             'extreme', CURRENT_DATE - INTERVAL '5 days', 
             'Inundación costera'),
            ('snow', 
             ST_Buffer(ST_MakePoint(-71.0, -41.0)::geography, 15000)::geometry,
             'medium', CURRENT_DATE - INTERVAL '1 day', 
             'Nevada intensa')
            ON CONFLICT DO NOTHING
        """)
        conn.commit()
        print("✅ Eventos climáticos de ejemplo creados")
    except Exception as e:
        print(f"⚠️  Error creando eventos climáticos: {e}")
        conn.rollback()
    
    cur.close()

def main():
    print("="*60)
    print("  CARGA DE DATOS A POSTGRESQL")
    print("="*60)
    
    # Conectar
    conn = connect_db()
    
    # Cargar datos
    total_edges = load_infrastructure(
        conn, 
        'infraestructura/rutas_filtradas_regiones.geojson'
    )
    
    total_earthquakes = load_earthquakes(
        conn,
        'amenazas/earthquakes.geojson'
    )
    
    # Crear datos de ejemplo para amenazas faltantes
    if total_edges > 0:
        create_sample_threats(conn)
    
    # Resumen
    print("\n" + "="*60)
    print("  ✅ RESUMEN DE CARGA")
    print("="*60)
    print(f"  Enlaces de fibra óptica: {total_edges}")
    print(f"  Sismos históricos: {total_earthquakes}")
    print(f"  Zonas de incendio: 3 (ejemplo)")
    print(f"  Eventos climáticos: 3 (ejemplo)")
    print("="*60)
    
    conn.close()
    print("\n🔌 Conexión cerrada")

if __name__ == '__main__':
    main()
