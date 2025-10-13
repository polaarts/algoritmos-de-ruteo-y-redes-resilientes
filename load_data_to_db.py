#!/usr/bin/env python3
"""
Script para cargar datos GeoJSON a PostgreSQL local
"""
import json
import psycopg2
from psycopg2.extras import execute_batch
import os
import sys

# Configuración de la base de datos
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'postgres'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

def connect_db():
    """Conecta a la base de datos"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"✅ Conectado a PostgreSQL en {DB_CONFIG['host']}")
        return conn
    except Exception as e:
        print(f"❌ Error conectando a la base de datos: {e}")
        sys.exit(1)

def load_datacenters(conn, filepath='/tmp/datacenters_fixed.geojson'):
    """Carga datacenters desde GeoJSON"""
    print(f"\n📂 Cargando datacenters desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    if not features:
        print("⚠️  No hay features en el archivo")
        return
    
    records = []
    for feature in features:
        props = feature.get('properties', {})
        coords = feature['geometry']['coordinates']
        
        record = (
            props.get('name'),
            props.get('company_name'),
            props.get('address'),
            props.get('city'),
            props.get('state'),
            props.get('country', 'Chile'),
            props.get('capacity_mw'),
            props.get('tier_level'),
            props.get('year_opened'),
            props.get('urban_density'),
            props.get('population_5km'),
            f"SRID=4326;POINT({coords[0]} {coords[1]})"
        )
        records.append(record)
    
    cursor = conn.cursor()
    
    # Limpiar tabla
    cursor.execute("DELETE FROM datacenters;")
    print(f"🗑️  Tabla datacenters limpiada")
    
    # Insertar datos
    sql = """
        INSERT INTO datacenters (
            name, company_name, address, city, state, country,
            capacity_mw, tier_level, year_opened, urban_density,
            population_5km, geometry
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, ST_GeomFromEWKT(%s)
        )
    """
    
    execute_batch(cursor, sql, records, page_size=100)
    conn.commit()
    
    print(f"✅ {len(records)} datacenters cargados")

def load_earthquakes(conn, filepath='/tmp/earthquakes.geojson'):
    """Carga sismos desde GeoJSON"""
    print(f"\n📂 Cargando sismos desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    if not features:
        print("⚠️  No hay features en el archivo")
        return
    
    records = []
    for feature in features:
        props = feature.get('properties', {})
        coords = feature['geometry']['coordinates']
        
        record = (
            props.get('id'),
            props.get('mag'),
            coords[2] if len(coords) > 2 else props.get('depth', 0),
            props.get('time'),
            props.get('place'),
            f"SRID=4326;POINT({coords[0]} {coords[1]})"
        )
        records.append(record)
    
    cursor = conn.cursor()
    
    # Limpiar tabla
    cursor.execute("DELETE FROM earthquakes;")
    print(f"🗑️  Tabla earthquakes limpiada")
    
    # Insertar datos
    sql = """
        INSERT INTO earthquakes (
            usgs_id, magnitude, depth, time, place, geometry
        ) VALUES (
            %s, %s, %s, to_timestamp(%s/1000.0), %s, ST_GeomFromEWKT(%s)
        )
        ON CONFLICT (usgs_id) DO NOTHING
    """
    
    execute_batch(cursor, sql, records, page_size=100)
    conn.commit()
    
    print(f"✅ {len(records)} sismos cargados")

def load_infrastructure(conn, filepath='/tmp/mapa_completo_v2.geojson'):
    """Carga infraestructura (edges) desde GeoJSON"""
    print(f"\n📂 Cargando infraestructura desde {filepath}...")
    
    if not os.path.exists(filepath):
        print(f"⚠️  Archivo no encontrado: {filepath}")
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    features = data.get('features', [])
    if not features:
        print("⚠️  No hay features en el archivo")
        return
    
    cursor = conn.cursor()
    
    # Limpiar tabla edges
    cursor.execute("DELETE FROM edges;")
    print(f"🗑️  Tabla edges limpiada")
    
    edges_count = 0
    for feature in features:
        geom_type = feature['geometry']['type']
        
        if geom_type == 'LineString':
            props = feature.get('properties', {})
            coords = feature['geometry']['coordinates']
            
            # Crear WKT para LineString
            coords_str = ','.join([f"{c[0]} {c[1]}" for c in coords])
            wkt = f"SRID=4326;LINESTRING({coords_str})"
            
            # Calcular longitud aproximada
            length = props.get('length', 0)
            
            try:
                cursor.execute("""
                    INSERT INTO edges (
                        osm_id, highway, name, surface, lanes, maxspeed,
                        oneway, bridge, tunnel, region, link_type,
                        recubrimiento_estim, length, geometry
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        ST_Length(ST_GeomFromEWKT(%s)::geography),
                        ST_GeomFromEWKT(%s)
                    )
                """, (
                    props.get('osm_id'),
                    props.get('highway'),
                    props.get('name'),
                    props.get('surface'),
                    props.get('lanes'),
                    props.get('maxspeed'),
                    props.get('oneway', False),
                    props.get('bridge', False),
                    props.get('tunnel', False),
                    props.get('region'),
                    props.get('link_type'),
                    props.get('recubrimiento_estim'),
                    wkt,
                    wkt
                ))
                edges_count += 1
                
                if edges_count % 100 == 0:
                    print(f"  Procesados {edges_count} edges...")
                    conn.commit()
            except Exception as e:
                print(f"⚠️  Error insertando edge: {e}")
                continue
    
    conn.commit()
    print(f"✅ {edges_count} edges cargados")

def main():
    """Función principal"""
    print("=" * 60)
    print("  CARGA DE DATOS A POSTGRESQL")
    print("=" * 60)
    
    conn = connect_db()
    
    try:
        # Cargar datacenters
        load_datacenters(conn)
        
        # Cargar sismos
        load_earthquakes(conn)
        
        # Cargar infraestructura
        load_infrastructure(conn)
        
        print("\n" + "=" * 60)
        print("  ✅ CARGA COMPLETADA EXITOSAMENTE")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Error durante la carga: {e}")
        conn.rollback()
    finally:
        conn.close()
        print("\n🔌 Conexión cerrada")

if __name__ == '__main__':
    main()
