/**
 * Script para verificar la geometría de fiber_links en Supabase
 * 
 * INSTRUCCIONES:
 * 
 * 1. Abre el dashboard de Supabase: https://supabase.com/dashboard
 * 2. Ve a tu proyecto
 * 3. Abre el "SQL Editor"
 * 4. Copia y pega esta consulta:
 */

-- ============================================
-- PASO 1: Ver ejemplos de enlaces
-- ============================================
SELECT 
  id, 
  name,
  source,
  target,
  ST_NumPoints(geometry) as num_points,
  ST_GeometryType(geometry) as geom_type,
  ST_Length(geometry::geography) / 1000 as length_km,
  CASE 
    WHEN ST_NumPoints(geometry) = 2 THEN 'LÍNEA RECTA ⚠️'
    WHEN ST_NumPoints(geometry) > 2 THEN 'GEOMETRÍA COMPLETA ✅'
    ELSE 'SIN GEOMETRÍA ❌'
  END as geometry_status
FROM fiber_links 
ORDER BY ST_NumPoints(geometry) ASC
LIMIT 10;

-- ============================================
-- PASO 2: Estadísticas generales
-- ============================================
SELECT 
  COUNT(*) as total_links,
  COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as straight_lines,
  COUNT(CASE WHEN ST_NumPoints(geometry) > 2 THEN 1 END) as complex_geometries,
  ROUND(AVG(ST_NumPoints(geometry)), 2) as avg_points_per_link,
  MAX(ST_NumPoints(geometry)) as max_points,
  MIN(ST_NumPoints(geometry)) as min_points,
  ROUND(
    (COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END)::numeric / COUNT(*)::numeric) * 100, 
    1
  ) as percent_straight_lines
FROM fiber_links;

-- ============================================
-- PASO 3: Ver un ejemplo de geometría completa
-- ============================================
SELECT 
  id,
  name,
  ST_NumPoints(geometry) as num_points,
  ST_AsText(geometry) as geometry_wkt
FROM fiber_links
WHERE ST_NumPoints(geometry) > 2
LIMIT 1;

-- ============================================
-- PASO 4: Ver un ejemplo de geometría como GeoJSON
-- ============================================
SELECT 
  id,
  name,
  ST_NumPoints(geometry) as num_points,
  ST_AsGeoJSON(geometry)::json as geometry_geojson
FROM fiber_links
WHERE ST_NumPoints(geometry) > 2
LIMIT 1;

/**
 * INTERPRETACIÓN DE RESULTADOS:
 * 
 * - Si num_points = 2:
 *   ❌ Línea recta entre dos puntos
 *   📝 No sigue las vías reales
 *   🔄 Necesitas reimportar con geometría completa
 * 
 * - Si num_points > 2:
 *   ✅ Geometría compleja que sigue las vías
 *   🗺️  Se visualizará correctamente en el mapa
 * 
 * - Si percent_straight_lines > 50%:
 *   ⚠️  La mayoría de tus datos son líneas rectas
 *   📂 Verifica el archivo fuente rutas_filtradas_regiones.geojson
 *   🔄 Reimporta los datos
 * 
 * - Si percent_straight_lines < 10%:
 *   ✅ Datos en buen estado
 *   🎉 La visualización debería ser realista
 */
