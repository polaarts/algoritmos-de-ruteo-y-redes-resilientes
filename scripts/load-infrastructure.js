#!/usr/bin/env node
/**
 * Script para cargar datos de infraestructura a la base de datos local
 * 
 * Carga nodos y enlaces de fibra óptica desde el archivo GeoJSON
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Configuración de base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fiber_network',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function loadInfrastructure() {
  console.log('\n🌐 CARGANDO INFRAESTRUCTURA DE RED\n');
  console.log('='.repeat(60));
  
  const geoJsonPath = path.join(__dirname, '../backend/infraestructura/data/rutas_filtradas_regiones.geojson');
  
  try {
    // Leer archivo GeoJSON
    console.log('\n📖 Leyendo archivo GeoJSON...');
    const contenido = await fs.readFile(geoJsonPath, 'utf-8');
    const data = JSON.parse(contenido);
    
    if (!data.features || data.features.length === 0) {
      console.log('⚠️  No se encontraron features en el archivo');
      return;
    }
    
    console.log(`✅ ${data.features.length} enlaces encontrados`);
    
    // Extraer nodos únicos
    console.log('\n📍 Extrayendo nodos únicos...');
    const nodesMap = new Map();
    
    data.features.forEach(feature => {
      const fromIdx = feature.properties.from_idx;
      const toIdx = feature.properties.to_idx;
      const coords = feature.geometry.coordinates;
      
      // Primer punto (from_node) - convertir a entero
      const fromId = Math.floor(fromIdx);
      if (fromId && !nodesMap.has(fromId)) {
        const firstCoord = coords[0];
        nodesMap.set(fromId, {
          osm_id: fromId,
          longitude: firstCoord[0],
          latitude: firstCoord[1],
          region: feature.properties.region || 'Unknown',
          node_type: 'junction'
        });
      }
      
      // Último punto (to_node) - convertir a entero
      const toId = Math.floor(toIdx);
      if (toId && !nodesMap.has(toId)) {
        const lastCoord = coords[coords.length - 1];
        nodesMap.set(toId, {
          osm_id: toId,
          longitude: lastCoord[0],
          latitude: lastCoord[1],
          region: feature.properties.region || 'Unknown',
          node_type: 'junction'
        });
      }
    });
    
    const nodes = Array.from(nodesMap.values());
    console.log(`✅ ${nodes.length} nodos únicos extraídos`);
    
    // Insertar nodos
    console.log('\n📥 Insertando nodos en la base de datos...');
    let insertedNodes = 0;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Mapa para almacenar osm_id -> id de la base de datos
      const osmIdToDbId = new Map();
      
      // Insertar nodos en lotes
      const batchSize = 500;
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        
        for (const node of batch) {
          try {
            const result = await client.query(
              `INSERT INTO fiber_nodes (osm_id, longitude, latitude, region, node_type)
               VALUES ($1, $2, $3, $4, $5)
               RETURNING id, osm_id`,
              [node.osm_id, node.longitude, node.latitude, node.region, node.node_type]
            );
            
            if (result.rows.length > 0) {
              // Convertir osm_id a número para que coincida con el tipo usado en from_idx/to_idx
              osmIdToDbId.set(parseInt(result.rows[0].osm_id), parseInt(result.rows[0].id));
              insertedNodes++;
            }
          } catch (err) {
            console.error(`❌ Error insertando nodo ${node.osm_id}:`, err.message);
          }
        }
        
        process.stdout.write(`\r   Progreso: ${Math.min(i + batchSize, nodes.length)}/${nodes.length} nodos`);
      }
      
      console.log(`\n✅ ${insertedNodes} nodos insertados correctamente`);
      console.log(`📍 ${osmIdToDbId.size} nodos mapeados para enlaces`);
      
      // Insertar enlaces usando los IDs de la base de datos
      console.log('\n📥 Insertando enlaces en la base de datos...');
      let insertedLinks = 0;
      let skippedLinks = 0;
      
      for (let i = 0; i < data.features.length; i += batchSize) {
        const batch = data.features.slice(i, i + batchSize);
        
        for (const feature of batch) {
          const fromOsmId = Math.floor(feature.properties.from_idx);
          const toOsmId = Math.floor(feature.properties.to_idx);
          const coords = feature.geometry.coordinates;
          
          if (!fromOsmId || !toOsmId) continue;
          
          // Obtener los IDs de la base de datos
          const sourceId = osmIdToDbId.get(fromOsmId);
          const targetId = osmIdToDbId.get(toOsmId);
          
          if (!sourceId || !targetId) {
            skippedLinks++;
            continue;
          }
          
          try {
            // Calcular longitud del enlace
            const wkt = `LINESTRING(${coords.map(c => `${c[0]} ${c[1]}`).join(', ')})`;
            
            const result = await client.query(
              `INSERT INTO fiber_links (source, target, geometry, length, region, link_type)
               VALUES ($1, $2, ST_SetSRID(ST_GeomFromText($3), 4326), 
                       ST_Length(ST_SetSRID(ST_GeomFromText($3), 4326)::geography) / 1000, 
                       $4, $5)
               RETURNING id`,
              [sourceId, targetId, wkt, feature.properties.region || 'Unknown', feature.properties.type || 'local']
            );
            
            if (result.rowCount > 0) {
              insertedLinks++;
            }
          } catch (err) {
            // Si hay un error, hacer rollback y volver a abrir transacción
            await client.query('ROLLBACK');
            await client.query('BEGIN');
            if (insertedLinks === 0) {
              // Si es el primer error, mostrarlo en detalle
              console.error(`\n❌ PRIMER ERROR insertando enlace ${fromOsmId} -> ${toOsmId}:`, err.message);
            }
            skippedLinks++;
          }
        }
        
        process.stdout.write(`\r   Progreso: ${Math.min(i + batchSize, data.features.length)}/${data.features.length} enlaces`);
      }
      
      console.log(`\n✅ ${insertedLinks} enlaces insertados correctamente`);
      if (skippedLinks > 0) {
        console.log(`⚠️  ${skippedLinks} enlaces omitidos (nodos no encontrados)`);
      }
      
      await client.query('COMMIT');
      
      // Verificar datos
      console.log('\n📊 Verificando datos cargados...');
      const nodeCount = await client.query('SELECT COUNT(*) FROM fiber_nodes');
      const linkCount = await client.query('SELECT COUNT(*) FROM fiber_links');
      
      console.log(`\n✅ RESUMEN DE CARGA:`);
      console.log(`   - Nodos en BD: ${nodeCount.rows[0].count}`);
      console.log(`   - Enlaces en BD: ${linkCount.rows[0].count}`);
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('\n❌ Error cargando infraestructura:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CARGA DE INFRAESTRUCTURA COMPLETADA\n');
}

// Ejecutar
if (require.main === module) {
  loadInfrastructure()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { loadInfrastructure };
