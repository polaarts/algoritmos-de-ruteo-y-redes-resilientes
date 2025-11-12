require('dotenv').config();
const fs = require('fs');
const { query } = require('./config/database');

/**
 * Script para reimportar fiber_links preservando la geometría completa
 * 
 * ANTES: Solo se guardaban inicio y fin (2 puntos)
 * DESPUÉS: Se guarda toda la geometría (LineString completo)
 */

async function reimportGeometry() {
  console.log('🔄 Reimportando geometrías de fiber_links...\n');

  try {
    // Leer el archivo GeoJSON
    const geojsonPath = './infraestructura/data/rutas_filtradas_regiones.geojson';
    console.log(`📂 Leyendo archivo: ${geojsonPath}`);
    
    const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const features = data.features;
    
    console.log(`✅ Archivo cargado: ${features.length} features encontradas\n`);

    // Verificar muestra
    const sample = features.slice(0, 3);
    console.log('📊 Muestra de geometrías:');
    sample.forEach((f, i) => {
      console.log(`  ${i + 1}. Tipo: ${f.geometry.type}, Puntos: ${f.geometry.coordinates.length}`);
    });
    console.log('');

    // Actualizar geometrías en la base de datos
    console.log('🔄 Actualizando geometrías en fiber_links...\n');
    
    let updated = 0;
    let errors = 0;
    let notFound = 0;

    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const geom = feature.geometry;
      
      if (geom.type !== 'LineString') {
        console.log(`⚠️  Feature ${i + 1}: No es LineString, saltando...`);
        continue;
      }

      // Extraer puntos inicial y final para identificar el enlace
      const coords = geom.coordinates;
      const startPoint = coords[0]; // [lon, lat]
      const endPoint = coords[coords.length - 1]; // [lon, lat]

      try {
        // Buscar el enlace por sus puntos inicial y final
        const findResult = await query(`
          SELECT fl.id, fl.name 
          FROM fiber_links fl
          JOIN fiber_nodes n1 ON fl.source = n1.id
          JOIN fiber_nodes n2 ON fl.target = n2.id
          WHERE 
            ST_Distance(
              n1.geometry::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) < 100
            AND ST_Distance(
              n2.geometry::geography,
              ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
            ) < 100
          LIMIT 1
        `, [startPoint[0], startPoint[1], endPoint[0], endPoint[1]]);

        if (findResult.rows.length === 0) {
          notFound++;
          if (notFound <= 5) {
            console.log(`⚠️  No se encontró enlace para puntos: [${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}] -> [${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}]`);
          }
          continue;
        }

        const linkId = findResult.rows[0].id;

        // Convertir coordenadas a WKT (Well-Known Text)
        const wktCoords = coords.map(c => `${c[0]} ${c[1]}`).join(', ');
        const wkt = `LINESTRING(${wktCoords})`;

        // Actualizar la geometría
        await query(`
          UPDATE fiber_links
          SET geometry = ST_GeomFromText($1, 4326)
          WHERE id = $2
        `, [wkt, linkId]);

        updated++;
        
        if (updated % 100 === 0) {
          console.log(`  ✅ Actualizados: ${updated} enlaces...`);
        }

      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`❌ Error en feature ${i + 1}:`, error.message);
        }
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`  ✅ Enlaces actualizados:    ${updated}`);
    console.log(`  ⚠️  Enlaces no encontrados: ${notFound}`);
    console.log(`  ❌ Errores:                 ${errors}`);
    console.log(`  📁 Total en archivo:        ${features.length}`);

    // Verificar resultado
    console.log('\n🔍 Verificando resultado...\n');
    const verification = await query(`
      SELECT 
        COUNT(*) as total_links,
        COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as straight_lines,
        COUNT(CASE WHEN ST_NumPoints(geometry) > 2 THEN 1 END) as complex_geometries,
        ROUND(AVG(ST_NumPoints(geometry)), 2) as avg_points,
        MAX(ST_NumPoints(geometry)) as max_points
      FROM fiber_links
    `);

    const v = verification.rows[0];
    console.log('📈 Estado actual de la base de datos:');
    console.log(`  Total de enlaces:      ${v.total_links}`);
    console.log(`  Líneas rectas:         ${v.straight_lines} (${((v.straight_lines/v.total_links)*100).toFixed(1)}%)`);
    console.log(`  Geometrías complejas:  ${v.complex_geometries} (${((v.complex_geometries/v.total_links)*100).toFixed(1)}%)`);
    console.log(`  Promedio de puntos:    ${v.avg_points}`);
    console.log(`  Máximo de puntos:      ${v.max_points}`);

    if (v.complex_geometries > 0) {
      console.log('\n✅ ¡Éxito! Ahora tienes geometrías complejas en la base de datos.');
      console.log('🗺️  Las rutas en el mapa ahora seguirán las vías reales.');
    } else {
      console.log('\n⚠️  No se pudieron actualizar las geometrías.');
      console.log('💡 Posibles causas:');
      console.log('   - Los nodos en fiber_nodes no coinciden con los del GeoJSON');
      console.log('   - Las coordenadas tienen demasiada diferencia');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  }
}

reimportGeometry();
