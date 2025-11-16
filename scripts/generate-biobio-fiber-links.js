const { Pool } = require('pg');

// Configuración de base de datos
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fiber_network',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

const OSRM_URL = process.env.OSRM_URL || 'http://localhost:5001';

/**
 * Obtiene todos los datacenters de la región del Biobío
 */
async function getDatacentersInBiobio() {
  const query = `
    SELECT 
      id,
      name,
      city,
      company_name,
      ST_X(location::geometry) as lon,
      ST_Y(location::geometry) as lat,
      capacity_mw,
      tier_level
    FROM datacenters
    WHERE region = 'Región del Biobío'
    ORDER BY id;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Obtiene una ruta realista usando OSRM
 */
async function getOSRMRoute(startLon, startLat, endLon, endLat) {
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  const url = `${OSRM_URL}/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
  
  console.log(`  Consultando OSRM: ${startLon},${startLat} -> ${endLon},${endLat}`);
  
  try {
    const response = await (await fetch)(url);
    
    if (!response.ok) {
      console.error(`  ❌ OSRM respondió con status ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.error(`  ❌ OSRM no encontró ruta: ${data.message || 'Unknown error'}`);
      return null;
    }
    
    return {
      geometry: data.routes[0].geometry,
      distance: data.routes[0].distance, // metros
      duration: data.routes[0].duration  // segundos
    };
  } catch (error) {
    console.error(`  ❌ Error consultando OSRM: ${error.message}`);
    return null;
  }
}

/**
 * Inserta un enlace de fibra en la base de datos
 */
async function insertFiberLink(sourceId, targetId, geometry, distance, type = 'trunk') {
  const query = `
    INSERT INTO fiber_links (
      source_node_id,
      target_node_id,
      length,
      capacity_gbps,
      link_type,
      geometry,
      created_with_osrm
    ) VALUES ($1, $2, $3, $4, $5, ST_GeomFromGeoJSON($6), true)
    ON CONFLICT (source_node_id, target_node_id) 
    DO UPDATE SET
      length = EXCLUDED.length,
      geometry = EXCLUDED.geometry,
      created_with_osrm = true,
      updated_at = NOW()
    RETURNING id;
  `;
  
  const lengthKm = distance / 1000; // convertir metros a km
  
  // Calcular capacidad basada en distancia
  let capacity = 100;
  if (lengthKm < 50) capacity = 400;
  else if (lengthKm < 100) capacity = 200;
  
  const values = [
    sourceId,
    targetId,
    lengthKm,
    capacity,
    type,
    JSON.stringify(geometry)
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

/**
 * Crea un nodo de fibra en la ubicación de un datacenter
 */
async function createNodeForDatacenter(datacenter) {
  const query = `
    INSERT INTO fiber_nodes (
      osm_id,
      location,
      node_type,
      name
    ) VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326), $4, $5)
    ON CONFLICT (osm_id) 
    DO UPDATE SET
      location = EXCLUDED.location,
      name = EXCLUDED.name
    RETURNING id;
  `;
  
  // Usar un OSM ID negativo para identificar que es un datacenter
  const osmId = -datacenter.id;
  
  const values = [
    osmId,
    datacenter.lon,
    datacenter.lat,
    'datacenter',
    `DC ${datacenter.city} - ${datacenter.company_name}`
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0].id;
}

/**
 * Genera enlaces de fibra entre todos los pares de datacenters
 */
async function generateFiberLinks() {
  console.log('🔧 GENERANDO ENLACES DE FIBRA CON OSRM');
  console.log('==========================================\n');
  
  // 1. Obtener datacenters
  console.log('📍 Obteniendo datacenters de la Región del Biobío...');
  const datacenters = await getDatacentersInBiobio();
  console.log(`   Encontrados ${datacenters.length} datacenters\n`);
  
  // 2. Crear nodos para cada datacenter
  console.log('🔨 Creando nodos de fibra para datacenters...');
  const nodeMap = new Map();
  
  for (const dc of datacenters) {
    const nodeId = await createNodeForDatacenter(dc);
    nodeMap.set(dc.id, nodeId);
    console.log(`   ✅ Nodo ${nodeId} creado para ${dc.name} (${dc.city})`);
  }
  console.log('');
  
  // 3. Generar enlaces entre todos los pares
  console.log('🌐 Generando enlaces entre datacenters...\n');
  
  let successCount = 0;
  let errorCount = 0;
  const totalPairs = (datacenters.length * (datacenters.length - 1)) / 2;
  let currentPair = 0;
  
  for (let i = 0; i < datacenters.length; i++) {
    for (let j = i + 1; j < datacenters.length; j++) {
      currentPair++;
      const dc1 = datacenters[i];
      const dc2 = datacenters[j];
      
      console.log(`[${currentPair}/${totalPairs}] ${dc1.city} <-> ${dc2.city}`);
      
      // Obtener ruta de OSRM
      const route = await getOSRMRoute(dc1.lon, dc1.lat, dc2.lon, dc2.lat);
      
      if (!route) {
        console.log(`  ⚠️  No se pudo obtener ruta, saltando...\n`);
        errorCount++;
        continue;
      }
      
      // Insertar enlace
      const sourceNodeId = nodeMap.get(dc1.id);
      const targetNodeId = nodeMap.get(dc2.id);
      
      try {
        const linkId = await insertFiberLink(
          sourceNodeId,
          targetNodeId,
          route.geometry,
          route.distance
        );
        
        console.log(`  ✅ Enlace ${linkId} creado: ${(route.distance / 1000).toFixed(2)} km\n`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error insertando enlace: ${error.message}\n`);
        errorCount++;
      }
    }
  }
  
  console.log('==========================================');
  console.log('✅ PROCESO COMPLETADO');
  console.log('==========================================');
  console.log(`Enlaces creados exitosamente: ${successCount}`);
  console.log(`Enlaces con error: ${errorCount}`);
  console.log(`Total procesado: ${totalPairs}`);
}

/**
 * Función principal
 */
async function main() {
  try {
    await generateFiberLinks();
  } catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { generateFiberLinks };
