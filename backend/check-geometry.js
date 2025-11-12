const { query } = require('./config/database');

async function checkGeometry() {
  console.log('\n🔍 Verificando geometría de fiber_links...\n');

  try {
    // Verificar geometría de los enlaces
    const result = await query(`
      SELECT 
        id, 
        name,
        source,
        target,
        ST_NumPoints(geometry) as num_points,
        ST_GeometryType(geometry) as geom_type,
        ST_Length(geometry::geography) / 1000 as length_km,
        CASE 
          WHEN ST_NumPoints(geometry) = 2 THEN '⚠️  LÍNEA RECTA'
          WHEN ST_NumPoints(geometry) > 2 THEN '✅ GEOMETRÍA COMPLETA'
          ELSE '❌ SIN GEOMETRÍA'
        END as geometry_status,
        ST_AsText(ST_StartPoint(geometry)) as start_point,
        ST_AsText(ST_EndPoint(geometry)) as end_point
      FROM fiber_links 
      ORDER BY ST_NumPoints(geometry) ASC
      LIMIT 10
    `);

    console.log('📊 Primeros 10 enlaces ordenados por complejidad:\n');
    console.log('─'.repeat(120));
    console.log(
      'ID'.padEnd(8) + 
      'Nombre'.padEnd(30) + 
      'Puntos'.padEnd(10) + 
      'Tipo'.padEnd(15) + 
      'Longitud(km)'.padEnd(15) + 
      'Estado'
    );
    console.log('─'.repeat(120));

    result.rows.forEach(row => {
      console.log(
        String(row.id).padEnd(8) + 
        (row.name || 'Sin nombre').substring(0, 28).padEnd(30) + 
        String(row.num_points).padEnd(10) + 
        row.geom_type.padEnd(15) + 
        parseFloat(row.length_km).toFixed(2).padEnd(15) + 
        row.geometry_status
      );
    });
    console.log('─'.repeat(120));

    // Estadísticas generales
    const stats = await query(`
      SELECT 
        COUNT(*) as total_links,
        COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as straight_lines,
        COUNT(CASE WHEN ST_NumPoints(geometry) > 2 THEN 1 END) as complex_geometries,
        ROUND(AVG(ST_NumPoints(geometry)), 2) as avg_points,
        MAX(ST_NumPoints(geometry)) as max_points,
        MIN(ST_NumPoints(geometry)) as min_points
      FROM fiber_links
    `);

    const s = stats.rows[0];
    const percentStraight = ((s.straight_lines / s.total_links) * 100).toFixed(1);
    const percentComplex = ((s.complex_geometries / s.total_links) * 100).toFixed(1);

    console.log('\n📈 Estadísticas Generales:\n');
    console.log(`  Total de enlaces:          ${s.total_links}`);
    console.log(`  Líneas rectas (2 puntos):  ${s.straight_lines} (${percentStraight}%) ⚠️`);
    console.log(`  Geometrías complejas:      ${s.complex_geometries} (${percentComplex}%) ✅`);
    console.log(`  Promedio de puntos:        ${s.avg_points}`);
    console.log(`  Mínimo de puntos:          ${s.min_points}`);
    console.log(`  Máximo de puntos:          ${s.max_points}`);

    // Recomendación
    console.log('\n💡 Recomendación:\n');
    if (percentStraight > 50) {
      console.log('  ❌ MÁS DEL 50% de tus enlaces son líneas rectas.');
      console.log('  📝 Necesitas reimportar los datos con geometría completa.');
      console.log('  📂 Verifica que el archivo rutas_filtradas_regiones.geojson tenga geometrías complejas.');
      console.log('  🔄 Ejecuta el script de carga con la opción de preservar geometría.');
    } else if (percentStraight > 0) {
      console.log('  ⚠️  Algunos enlaces son líneas rectas, pero la mayoría tiene geometría completa.');
      console.log('  ✅ La visualización debería ser mayormente realista.');
    } else {
      console.log('  ✅ ¡Perfecto! Todos tus enlaces tienen geometría completa.');
      console.log('  🗺️  Las rutas en el mapa deberían seguir las vías reales.');
    }

    // Verificar un ejemplo de geometría completa
    console.log('\n🔬 Ejemplo de geometría compleja:\n');
    const example = await query(`
      SELECT 
        id,
        name,
        ST_NumPoints(geometry) as num_points,
        ST_AsText(geometry) as geometry_text
      FROM fiber_links
      WHERE ST_NumPoints(geometry) > 2
      LIMIT 1
    `);

    if (example.rows.length > 0) {
      const ex = example.rows[0];
      console.log(`  Enlace #${ex.id}: ${ex.name || 'Sin nombre'}`);
      console.log(`  Puntos: ${ex.num_points}`);
      console.log(`  Geometría (primeros 200 chars):`);
      console.log(`  ${ex.geometry_text.substring(0, 200)}...`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkGeometry();
