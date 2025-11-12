const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'backend', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: { rejectUnauthorized: false }
});

console.log('🔧 Configuración:');
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   Base de datos: ${process.env.DB_NAME}`);

/**
 * Genera la red completa con nodos y edges
 */
async function generateNetwork() {
    console.log('\n' + '='.repeat(60));
    console.log('  GENERACIÓN DE RED CON PROBABILIDADES');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        // 1. Crear nodos desde datacenters
        const nodeCount = await createNodesFromDatacenters(client);
        
        if (nodeCount === 0) {
            console.error('❌ No hay datacenters para crear nodos');
            return;
        }

        // 2. Obtener todos los nodos
        const nodesResult = await client.query('SELECT * FROM fiber_nodes ORDER BY id');
        const nodes = nodesResult.rows;
        console.log(`\n📍 Nodos disponibles: ${nodes.length}`);

        // 3. Generar edges entre nodos cercanos
        await generateEdgesWithProbabilities(client, nodes);

        console.log('\n✅ Red generada exitosamente');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Crea nodos desde los datacenters
 */
async function createNodesFromDatacenters(client) {
    console.log('\n🔵 Creando nodos desde datacenters...');

    // Limpiar nodos existentes
    await client.query('DELETE FROM fiber_links');
    await client.query('DELETE FROM fiber_nodes');

    // Obtener datacenters
    const dcResult = await client.query(`
        SELECT 
            id,
            name,
            company_name,
            capacity_mw,
            ST_X(geometry) as lon,
            ST_Y(geometry) as lat,
            urban_density
        FROM datacenters
        ORDER BY id
    `);

    const datacenters = dcResult.rows;
    console.log(`   Datacenters encontrados: ${datacenters.length}`);

    if (datacenters.length === 0) {
        return 0;
    }

    let inserted = 0;
    for (const dc of datacenters) {
        try {
            // Determinar región basada en ciudad
            const region = getRegionFromCity(dc.city);
            
            await client.query(`
                INSERT INTO fiber_nodes (
                    osm_id,
                    node_type,
                    latitude,
                    longitude,
                    region,
                    city,
                    is_critical,
                    redundancy_level,
                    geometry
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326))
            `, [
                1000000 + dc.id,
                'datacenter',
                dc.lat,
                dc.lon,
                region,
                dc.city || 'Unknown',
                true, // Los datacenters son críticos
                3,    // Nivel de redundancia medio-alto
                dc.lon,
                dc.lat
            ]);

            inserted++;
        } catch (error) {
            console.error(`⚠️  Error insertando nodo (DC ID ${dc.id}): ${error.message}`);
        }
    }

    console.log(`✅ Nodos creados: ${inserted}`);
    return inserted;
}

/**
 * Mapea ciudad a región
 */
function getRegionFromCity(city) {
    const cityToRegion = {
        'santiago': 'Región Metropolitana',
        'providencia': 'Región Metropolitana',
        'huechuraba': 'Región Metropolitana',
        'colina': 'Región Metropolitana',
        'renca': 'Región Metropolitana',
        'valparaíso': 'Región de Valparaíso',
        'viña del mar': 'Región de Valparaíso',
        'concepción': 'Región del Biobío',
        'la serena': 'Región de Coquimbo',
        'antofagasta': 'Región de Antofagasta',
        'temuco': 'Región de La Araucanía',
        'puerto montt': 'Región de Los Lagos'
    };
    
    const cityLower = (city || '').toLowerCase();
    for (const [key, value] of Object.entries(cityToRegion)) {
        if (cityLower.includes(key)) {
            return value;
        }
    }
    return 'Región Metropolitana';
}

/**
 * Genera edges con probabilidades entre nodos cercanos
 */
async function generateEdgesWithProbabilities(client, nodes) {
    console.log('\n🔗 Generando edges con probabilidades...');

    const MAX_DISTANCE_KM = 100; // Conectar nodos hasta 100km de distancia
    const edges = [];

    console.log(`   Calculando distancias entre ${nodes.length} nodos...`);

    // Generar edges entre todos los pares de nodos
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const nodeA = nodes[i];
            const nodeB = nodes[j];

            // Calcular distancia usando PostGIS entre dos IDs de nodos
            const distResult = await client.query(`
                SELECT ST_Distance(
                    (SELECT geometry::geography FROM fiber_nodes WHERE id = $1),
                    (SELECT geometry::geography FROM fiber_nodes WHERE id = $2)
                ) / 1000.0 as distance_km
            `, [nodeA.id, nodeB.id]);

            const distance = parseFloat(distResult.rows[0].distance_km);

            // Solo conectar nodos cercanos
            if (distance <= MAX_DISTANCE_KM) {
                const edge = await createEdgeWithProbabilities(
                    client,
                    nodeA,
                    nodeB,
                    distance
                );
                edges.push(edge);
            }
        }

        if ((i + 1) % 5 === 0) {
            console.log(`   Procesados ${i + 1} / ${nodes.length} nodos...`);
        }
    }

    console.log(`\n   Edges a insertar: ${edges.length}`);

    // Insertar edges
    let inserted = 0;
    for (const edge of edges) {
        try {
            await client.query(`
                INSERT INTO fiber_links (
                    source,
                    target,
                    length,
                    bandwidth_gbps,
                    cost,
                    reverse_cost,
                    highway,
                    surface,
                    region,
                    link_type,
                    recubrimiento_estim,
                    is_redundant,
                    geometry
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                         ST_MakeLine(
                             (SELECT geometry FROM fiber_nodes WHERE id = $1),
                             (SELECT geometry FROM fiber_nodes WHERE id = $2)
                         ))
            `, [
                edge.source_id,
                edge.target_id,
                edge.length_km * 1000, // Convertir a metros
                edge.capacity_gbps,
                edge.cost,
                edge.reverse_cost,
                edge.terrain_type || 'primary',
                edge.coverage_type || 'paved',
                edge.region || 'Región Metropolitana',
                edge.link_type || 'regional',
                `${edge.ground_stability} - risk: ${(edge.total_risk * 100).toFixed(1)}%`,
                false,
            ]);

            inserted++;

            if (inserted % 10 === 0) {
                console.log(`   ✓ Insertados ${inserted} / ${edges.length} edges...`);
            }
        } catch (error) {
            console.error(`⚠️  Error insertando edge: ${error.message}`);
        }
    }

    console.log(`\n✅ Edges insertados: ${inserted}`);

    // Mostrar estadísticas
    await showEdgeStatistics(client);
}

/**
 * Crea un edge con probabilidades calculadas
 */
async function createEdgeWithProbabilities(client, nodeA, nodeB, distance) {
    // Obtener punto medio para consultar metadatos
    const midLat = (nodeA.latitude + nodeB.latitude) / 2;
    const midLon = (nodeA.longitude + nodeB.longitude) / 2;

    // Consultar metadatos geográficos en el punto medio
    const terrainData = await getTerrainData(client, midLat, midLon);
    const groundData = await getGroundData(client, midLat, midLon);

    // Calcular probabilidades
    const baseFailure = 0.01; // 1% base
    const environmentalRisk = calculateEnvironmentalRisk(terrainData, groundData, distance);
    const infrastructureRisk = calculateInfrastructureRisk(terrainData, distance);
    
    // Calcular capacidad base (Gbps)
    const capacity = 10; // 10 Gbps por enlace

    // Calcular costo basado en distancia y riesgos
    const baseCost = distance * 1000; // metros
    const totalRisk = baseFailure + environmentalRisk + infrastructureRisk;
    const riskMultiplier = 1 + totalRisk;
    const cost = baseCost * riskMultiplier;

    // Determinar región
    const region = getRegionFromCity(nodeA.city || 'Santiago');

    // Determinar tipo de enlace basado en distancia
    let linkType = 'local';
    if (distance > 50) linkType = 'regional';
    if (distance > 200) linkType = 'national';

    return {
        source_id: nodeA.id,
        target_id: nodeB.id,
        length_km: distance,
        capacity_gbps: capacity,
        cost: cost,
        reverse_cost: cost, // Bidireccional
        base_failure_probability: baseFailure,
        environmental_risk: environmentalRisk,
        infrastructure_risk: infrastructureRisk,
        total_risk: totalRisk,
        terrain_type: terrainData.terrain_type,
        coverage_type: terrainData.coverage_type,
        ground_stability: groundData.stability,
        infrastructure_support: terrainData.infrastructure_support,
        region: region,
        link_type: linkType
    };
}

/**
 * Obtiene datos de terreno en un punto (basado en coordenadas)
 */
async function getTerrainData(client, lat, lon) {
    // Como no existe infrastructure_metadata, usar heurísticas basadas en coordenadas
    
    // Clasificar por latitud (Chile tiene variedad geográfica norte-sur)
    let terrain_type, coverage_type, infrastructure_support;
    
    if (lat > -24) {
        // Norte (Arica, Iquique, Antofagasta) - desierto
        terrain_type = 'desert';
        coverage_type = 'low';
        infrastructure_support = 'medium';
    } else if (lat > -32) {
        // Norte Chico (Coquimbo, La Serena) - semiárido
        terrain_type = 'mixed';
        coverage_type = 'medium';
        infrastructure_support = 'medium';
    } else if (lat > -34) {
        // Región Metropolitana - urbano
        terrain_type = 'urban';
        coverage_type = 'high';
        infrastructure_support = 'high';
    } else if (lat > -38) {
        // Centro (Valparaíso, O'Higgins, Maule, Biobío) - mixto
        terrain_type = 'mixed';
        coverage_type = 'medium';
        infrastructure_support = 'medium';
    } else if (lat > -42) {
        // Sur (Araucanía, Los Ríos, Los Lagos) - bosques
        terrain_type = 'forest';
        coverage_type = 'low';
        infrastructure_support = 'low';
    } else {
        // Extremo sur - montañas y costa
        terrain_type = 'mountains';
        coverage_type = 'low';
        infrastructure_support = 'low';
    }

    return {
        terrain_type,
        coverage_type,
        infrastructure_support
    };
}

/**
 * Obtiene datos de suelo en un punto
 */
async function getGroundData(client, lat, lon) {
    try {
        const result = await client.query(`
            SELECT stability
            FROM ground_type
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                5000
            )
            ORDER BY ST_Distance(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            )
            LIMIT 1
        `, [lon, lat]);

        if (result.rows.length > 0) {
            return { stability: result.rows[0].stability };
        }
    } catch (error) {
        // Si no hay datos, usar defaults
    }

    return { stability: 'moderate' };
}

/**
 * Calcula riesgo ambiental
 */
function calculateEnvironmentalRisk(terrainData, groundData, distance) {
    let risk = 0.0;

    // Riesgo por tipo de terreno
    const terrainRisk = {
        'urban': 0.01,
        'rural': 0.02,
        'forest': 0.03,
        'desert': 0.04,
        'mountains': 0.05,
        'coastal': 0.03,
        'flat': 0.01,
        'mixed': 0.02
    };
    risk += terrainRisk[terrainData.terrain_type] || 0.02;

    // Riesgo por estabilidad del suelo
    const stabilityRisk = {
        'stable': 0.00,
        'moderate': 0.02,
        'unstable': 0.05,
        'very_unstable': 0.10
    };
    risk += stabilityRisk[groundData.stability] || 0.02;

    // Riesgo por distancia (enlaces más largos = más riesgo)
    risk += (distance / 200) * 0.01; // +1% por cada 200km

    return Math.min(risk, 0.20); // Cap a 20%
}

/**
 * Calcula riesgo de infraestructura
 */
function calculateInfrastructureRisk(terrainData, distance) {
    let risk = 0.0;

    // Riesgo por soporte de infraestructura
    const supportRisk = {
        'high': -0.01,  // Reduce riesgo
        'medium': 0.00,
        'low': 0.02,
        'none': 0.05
    };
    risk += supportRisk[terrainData.infrastructure_support] || 0.0;

    // Riesgo por cobertura/densidad
    const coverageRisk = {
        'high': -0.01,  // Reduce riesgo
        'medium': 0.00,
        'low': 0.02
    };
    risk += coverageRisk[terrainData.coverage_type] || 0.0;

    return Math.max(risk, 0.0); // No puede ser negativo
}

/**
 * Muestra estadísticas de los edges generados
 */
async function showEdgeStatistics(client) {
    console.log('\n📊 Estadísticas de la red:');

    // Total de edges
    const totalResult = await client.query('SELECT COUNT(*) as count FROM fiber_links');
    console.log(`   • Total de enlaces: ${totalResult.rows[0].count}`);

    // Total de nodos
    const nodesResult = await client.query('SELECT COUNT(*) as count FROM fiber_nodes');
    console.log(`   • Total de nodos: ${nodesResult.rows[0].count}`);

    // Distribución por región
    const regionResult = await client.query(`
        SELECT region, COUNT(*) as count
        FROM fiber_links
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY count DESC
        LIMIT 5
    `);

    console.log('\n   📍 Top 5 regiones por enlaces:');
    for (const row of regionResult.rows) {
        console.log(`      • ${row.region}: ${row.count} enlaces`);
    }

    // Distribución por tipo de enlace
    const typeResult = await client.query(`
        SELECT link_type, COUNT(*) as count
        FROM fiber_links
        WHERE link_type IS NOT NULL
        GROUP BY link_type
        ORDER BY count DESC
    `);

    console.log('\n   � Distribución por tipo de enlace:');
    for (const row of typeResult.rows) {
        console.log(`      • ${row.link_type}: ${row.count} enlaces`);
    }

    // Estadísticas de longitud
    const lengthResult = await client.query(`
        SELECT 
            AVG(length) / 1000 as avg_km,
            MIN(length) / 1000 as min_km,
            MAX(length) / 1000 as max_km
        FROM fiber_links
    `);

    const len = lengthResult.rows[0];
    console.log('\n   📏 Distancias (km):');
    console.log(`      • Promedio: ${parseFloat(len.avg_km).toFixed(2)} km`);
    console.log(`      • Mínima: ${parseFloat(len.min_km).toFixed(2)} km`);
    console.log(`      • Máxima: ${parseFloat(len.max_km).toFixed(2)} km`);
    
    console.log('\n   💡 Nota: Las probabilidades de falla se calcularon y almacenaron');
    console.log('      en el campo recubrimiento_estim como metadata.');
}

/**
 * Función principal
 */
async function main() {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL\n');

        await generateNetwork();

        console.log('\n' + '='.repeat(60));
        console.log('  ✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Conexión cerrada');
    }
}

if (require.main === module) {
    main();
}

module.exports = { generateNetwork };
