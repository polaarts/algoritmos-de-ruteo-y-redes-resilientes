#!/usr/bin/env python3
"""
Script simplificado para cargar datos GeoJSON locales a PostgreSQL
"""
import json
import psycopg2
from psycopg2.extras import execute_batch
import os

# Configuración de la base de datos
DB_CONFIG = {
    'host': 'localhost',
    'port': '5432',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'postgres'
}

def connect_db():
    """Conecta a la base de datos"""
    conn = psycopg2.connect(**DB_CONFIG)
    print("✅ Conectado a PostgreSQL")
    return conn

def load_infrastructure(conn, filepath):
    """Carga infraestructura de red desde GeoJSON"""
    print(f"\n📂 Cargando infraestructura desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    print(f"📊 Encontradas {len(features)} features")
    
    cur = conn.cursor()
    
    # Insertar features
    inserted = 0
    for idx, feature in enumerate(features):
        try:
            props = feature.get('properties', {})
            geom = feature['geometry']
            
            # Convertir geometry a GeoJSON string
            geom_json = json.dumps(geom)
            
            # Insertar
            cur.execute("""
                INSERT INTO edges (
                    osm_id, geometry, highway, surface, length
                ) VALUES (
                    %s, ST_GeomFromGeoJSON(%s), %s, %s, ST_Length(ST_GeomFromGeoJSON(%s)::geography)
                )
                ON CONFLICT DO NOTHING
            """, (
                props.get('@id', f'synthetic_{idx}'),
                geom_json,
                props.get('highway', 'unclassified'),
                props.get('surface', 'unknown'),
                geom_json
            ))
            
            if cur.rowcount > 0:
                inserted += 1
                
            if (idx + 1) % 100 == 0:
                conn.commit()
                print(f"  ✓ Procesados {idx + 1} / {len(features)} ...")
                
        except Exception as e:
            print(f"⚠️  Error en feature {idx}: {e}")
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
