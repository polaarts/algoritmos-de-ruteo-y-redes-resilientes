-- Script SQL para actualizar geometrías de fiber_links
-- Este script debe ejecutarse DESPUÉS de cargar el GeoJSON con geometrías completas

-- OPCIÓN 1: Si tienes una tabla temporal con los datos del GeoJSON
-- (Primero debes cargar rutas_filtradas_regiones.geojson a una tabla temporal)

-- Crear tabla temporal para el GeoJSON
DROP TABLE IF EXISTS fiber_links_geojson;
CREATE TABLE fiber_links_geojson (
  id SERIAL PRIMARY KEY,
  geometry GEOMETRY(LineString, 4326),
  properties JSONB
);

-- Aquí deberías usar pgAdmin, QGIS, o ogr2ogr para cargar el GeoJSON:
-- ogr2ogr -f "PostgreSQL" PG:"dbname=postgres ..." rutas_filtradas_regiones.geojson -nln fiber_links_geojson

-- Una vez cargado, actualizar las geometrías en fiber_links:
UPDATE fiber_links fl
SET geometry = flg.geometry
FROM fiber_links_geojson flg
WHERE ST_Distance(
  ST_StartPoint(fl.geometry)::geography,
  ST_StartPoint(flg.geometry)::geography
) < 100
AND ST_Distance(
  ST_EndPoint(fl.geometry)::geography,
  ST_EndPoint(flg.geometry)::geography
) < 100;

-- Verificar resultado
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as straight,
  COUNT(CASE WHEN ST_NumPoints(geometry) > 2 THEN 1 END) as complex,
  ROUND(AVG(ST_NumPoints(geometry)), 2) as avg_points
FROM fiber_links;

-- ============================================
-- OPCIÓN 2: Solución temporal - Interpolar puntos
-- ============================================
-- Si no puedes recargar el GeoJSON, puedes interpolar puntos
-- intermedios para simular geometría realista:

DO $$
DECLARE
  link_record RECORD;
  num_segments INT := 5; -- Número de segmentos a crear
  new_geom GEOMETRY;
BEGIN
  FOR link_record IN 
    SELECT id, geometry FROM fiber_links WHERE ST_NumPoints(geometry) = 2
  LOOP
    -- Crear geometría interpolada con más puntos
    new_geom := ST_Segmentize(link_record.geometry::geography, 
                               ST_Length(link_record.geometry::geography) / num_segments)::geometry;
    
    UPDATE fiber_links 
    SET geometry = new_geom 
    WHERE id = link_record.id;
  END LOOP;
  
  RAISE NOTICE 'Geometrías interpoladas actualizadas';
END $$;

-- Verificar después de interpolar
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as straight,
  COUNT(CASE WHEN ST_NumPoints(geometry) > 2 THEN 1 END) as complex,
  ROUND(AVG(ST_NumPoints(geometry)), 2) as avg_points,
  MAX(ST_NumPoints(geometry)) as max_points
FROM fiber_links;

-- ============================================
-- NOTA IMPORTANTE:
-- ============================================
-- La interpolación (OPCIÓN 2) NO sigue las vías reales, solo agrega
-- puntos intermedios en línea recta. Es mejor usar la OPCIÓN 1
-- para cargar las geometrías reales del archivo GeoJSON.
