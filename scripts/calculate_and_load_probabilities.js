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
 * Calcula y carga probabilidades de nodos y enlaces
 */
async function calculateAndLoadProbabilities() {
    console.log('\n' + '='.repeat(60));
    console.log('  CÁLCULO Y CARGA DE PROBABILIDADES');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        // 1. Calcular probabilidades de nodos
        await calculateNodeProbabilities(client);

        // 2. Calcular probabilidades de enlaces
        await calculateEdgeProbabilities(client);

        console.log('\n✅ Probabilidades calculadas y cargadas exitosamente');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Calcula y carga probabilidades para cada nodo
 */
async function calculateNodeProbabilities(client) {
    console.log('\n📍 Calculando probabilidades de nodos...');

    // Obtener todos los nodos
    const nodesResult = await client.query(`
        SELECT id, latitude, longitude, region, city
        FROM fiber_nodes
        ORDER BY id
    `);

    const nodes = nodesResult.rows;
    console.log(`   Nodos a procesar: ${nodes.length}`);

    // Limpiar tabla de probabilidades
    await client.query('DELETE FROM node_probabilities');

    let inserted = 0;
    for (const node of nodes) {
        try {
            // Calcular probabilidades basadas en amenazas cercanas
            const earthquakeProb = await calculateEarthquakeProbability(client, node);
            const fireProb = await calculateFireProbability(client, node);
            const floodProb = await calculateFloodProbability(client, node);
            const weatherProb = await calculateWeatherProbability(client, node);

            // Calcular probabilidad total (máximo 100)
            const totalProb = Math.min(100, 
                earthquakeProb + fireProb + floodProb + weatherProb
            );

            // Factores de metadata
            const groundStabilityFactor = await getGroundStabilityFactor(client, node);
            const urbanDensityFactor = getUrbanDensityFactor(node);

            // Insertar en la tabla
            await client.query(`
                INSERT INTO node_probabilities (
                    node_id,
                    earthquake_probability,
                    fire_probability,
                    flood_probability,
                    weather_probability,
                    total_failure_probability,
                    ground_stability_factor,
                    urban_density_factor,
                    calculation_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                node.id,
                earthquakeProb,
                fireProb,
                floodProb,
                weatherProb,
                totalProb,
                groundStabilityFactor,
                urbanDensityFactor,
                'proximity_weighted'
            ]);

            inserted++;

            if (inserted % 10 === 0) {
                console.log(`   ✓ Procesados ${inserted} / ${nodes.length} nodos...`);
            }
        } catch (error) {
            console.error(`⚠️  Error procesando nodo ${node.id}: ${error.message}`);
        }
    }

    console.log(`✅ Probabilidades de nodos insertadas: ${inserted}`);
    await showNodeProbabilityStats(client);
}

/**
 * Calcula y carga probabilidades para cada enlace
 */
async function calculateEdgeProbabilities(client) {
    console.log('\n🔗 Calculando probabilidades de enlaces...');

    // Obtener todos los enlaces
    const edgesResult = await client.query(`
        SELECT 
            fl.id,
            fl.source,
            fl.target,
            fl.length,
            fl.highway,
            fl.bridge,
            fl.tunnel,
            fl.surface,
            ST_X(ST_Centroid(fl.geometry)) as center_lon,
            ST_Y(ST_Centroid(fl.geometry)) as center_lat
        FROM fiber_links fl
        ORDER BY fl.id
    `);

    const edges = edgesResult.rows;
    console.log(`   Enlaces a procesar: ${edges.length}`);

    // Limpiar tabla de probabilidades
    await client.query('DELETE FROM edge_probabilities');

    let inserted = 0;
    for (const edge of edges) {
        try {
            // Calcular probabilidades basadas en amenazas que cruza el enlace
            const earthquakeProb = await calculateEdgeEarthquakeProbability(client, edge);
            const fireProb = await calculateEdgeFireProbability(client, edge);
            const floodProb = await calculateEdgeFloodProbability(client, edge);
            const weatherProb = await calculateEdgeWeatherProbability(client, edge);
            const landslideProb = await calculateLandslideProbability(client, edge);

            // Calcular probabilidad total
            const totalProb = Math.min(100,
                earthquakeProb + fireProb + floodProb + weatherProb + landslideProb
            );

            // Factores de infraestructura
            const bridgeFactor = edge.bridge ? 1.5 : 1.0;
            const tunnelFactor = edge.tunnel ? 0.8 : 1.0;
            const surfaceQualityFactor = getSurfaceQualityFactor(edge.surface);

            // Insertar en la tabla
            await client.query(`
                INSERT INTO edge_probabilities (
                    edge_id,
                    earthquake_probability,
                    fire_probability,
                    flood_probability,
                    weather_probability,
                    landslide_probability,
                    total_failure_probability,
                    bridge_factor,
                    tunnel_factor,
                    surface_quality_factor,
                    calculation_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                edge.id,
                earthquakeProb,
                fireProb,
                floodProb,
                weatherProb,
                landslideProb,
                totalProb,
                bridgeFactor,
                tunnelFactor,
                surfaceQualityFactor,
                'path_intersection_weighted'
            ]);

            inserted++;

            if (inserted % 100 === 0) {
                console.log(`   ✓ Procesados ${inserted} / ${edges.length} enlaces...`);
            }
        } catch (error) {
            console.error(`⚠️  Error procesando enlace ${edge.id}: ${error.message}`);
        }
    }

    console.log(`✅ Probabilidades de enlaces insertadas: ${inserted}`);
    await showEdgeProbabilityStats(client);
}

// ============================================================================
// FUNCIONES DE CÁLCULO DE PROBABILIDADES - NODOS
// ============================================================================

/**
 * Calcula probabilidad de terremoto para un nodo
 */
async function calculateEarthquakeProbability(client, node) {
    try {
        // Buscar terremotos en un radio de 50km
        const result = await client.query(`
            SELECT 
                magnitude,
                ST_Distance(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0 as distance_km
            FROM earthquakes
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                50000
            )
            ORDER BY magnitude DESC, distance_km ASC
            LIMIT 5
        `, [node.longitude, node.latitude]);

        if (result.rows.length === 0) {
            return 5; // Probabilidad base de 5% en Chile (zona sísmica)
        }

        // Calcular probabilidad ponderada por magnitud y distancia
        let totalProb = 5; // Base
        for (const quake of result.rows) {
            const magFactor = Math.pow(quake.magnitude / 5.0, 2); // Factor exponencial
            const distFactor = Math.max(0, 1 - (quake.distance_km / 50));
            totalProb += magFactor * distFactor * 10;
        }

        return Math.min(50, totalProb); // Cap a 50%
    } catch (error) {
        return 5; // Probabilidad base en caso de error
    }
}

/**
 * Calcula probabilidad de incendio para un nodo
 */
async function calculateFireProbability(client, node) {
    try {
        // Buscar zonas de riesgo de incendio cercanas
        const result = await client.query(`
            SELECT 
                risk_level,
                ST_Distance(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0 as distance_km
            FROM fire_risk_zones
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                30000
            )
            ORDER BY distance_km ASC
            LIMIT 1
        `, [node.longitude, node.latitude]);

        if (result.rows.length === 0) {
            return 2; // Probabilidad base baja
        }

        const zone = result.rows[0];
        const riskMap = { 'low': 3, 'medium': 8, 'high': 15, 'extreme': 25 };
        const baseRisk = riskMap[zone.risk_level] || 5;
        const distFactor = Math.max(0, 1 - (zone.distance_km / 30));

        return baseRisk * distFactor;
    } catch (error) {
        return 2;
    }
}

/**
 * Calcula probabilidad de inundación para un nodo
 */
async function calculateFloodProbability(client, node) {
    // Basado en latitud (zonas costeras y sur tienen más riesgo)
    const lat = node.latitude;
    
    if (lat < -40) return 12; // Sur extremo
    if (lat < -35) return 8;  // Sur
    if (lat > -25) return 5;  // Norte (costa)
    return 4; // Resto
}

/**
 * Calcula probabilidad de eventos climáticos para un nodo
 */
async function calculateWeatherProbability(client, node) {
    try {
        // Buscar eventos climáticos recientes cercanos
        const result = await client.query(`
            SELECT 
                severity,
                ST_Distance(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) / 1000.0 as distance_km
            FROM weather_events
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                40000
            )
            ORDER BY event_date DESC
            LIMIT 3
        `, [node.longitude, node.latitude]);

        if (result.rows.length === 0) {
            return 3; // Probabilidad base
        }

        const severityMap = { 'low': 3, 'medium': 8, 'high': 15, 'extreme': 25 };
        let totalProb = 3;
        for (const event of result.rows) {
            const baseRisk = severityMap[event.severity] || 5;
            const distFactor = Math.max(0, 1 - (event.distance_km / 40));
            totalProb += baseRisk * distFactor * 0.3; // Factor reducido
        }

        return Math.min(20, totalProb);
    } catch (error) {
        return 3;
    }
}

/**
 * Obtiene factor de estabilidad del suelo
 */
async function getGroundStabilityFactor(client, node) {
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
        `, [node.longitude, node.latitude]);

        if (result.rows.length === 0) {
            return 1.0;
        }

        const stabilityMap = {
            'stable': 0.7,
            'moderate': 1.0,
            'unstable': 1.4,
            'very_unstable': 1.8
        };

        return stabilityMap[result.rows[0].stability] || 1.0;
    } catch (error) {
        return 1.0;
    }
}

/**
 * Obtiene factor de densidad urbana
 */
function getUrbanDensityFactor(node) {
    // Áreas urbanas son más resilientes (mejor infraestructura)
    const region = node.region || '';
    const city = node.city || '';

    if (region.includes('Metropolitana') || city.toLowerCase().includes('santiago')) {
        return 0.7; // Reduce riesgo 30%
    }

    if (city.toLowerCase().includes('valparaíso') || 
        city.toLowerCase().includes('concepción') ||
        city.toLowerCase().includes('viña')) {
        return 0.85; // Reduce riesgo 15%
    }

    return 1.0; // Sin cambio
}

// ============================================================================
// FUNCIONES DE CÁLCULO DE PROBABILIDADES - ENLACES
// ============================================================================

/**
 * Calcula probabilidad de terremoto para un enlace
 */
async function calculateEdgeEarthquakeProbability(client, edge) {
    try {
        const result = await client.query(`
            SELECT AVG(magnitude) as avg_magnitude, COUNT(*) as count
            FROM earthquakes
            WHERE ST_DWithin(
                geometry::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                50000
            )
        `, [edge.center_lon, edge.center_lat]);

        if (result.rows[0].count == 0) {
            return 5;
        }

        const avgMag = parseFloat(result.rows[0].avg_magnitude);
        return Math.min(40, 5 + (avgMag - 4) * 5);
    } catch (error) {
        return 5;
    }
}

/**
 * Calcula probabilidad de incendio para un enlace
 */
async function calculateEdgeFireProbability(client, edge) {
    try {
        const result = await client.query(`
            SELECT risk_level
            FROM fire_risk_zones
            WHERE ST_Intersects(
                geometry,
                (SELECT geometry FROM fiber_links WHERE id = $1)
            )
            ORDER BY 
                CASE risk_level
                    WHEN 'extreme' THEN 4
                    WHEN 'high' THEN 3
                    WHEN 'medium' THEN 2
                    ELSE 1
                END DESC
            LIMIT 1
        `, [edge.id]);

        if (result.rows.length === 0) {
            return 3;
        }

        const riskMap = { 'low': 5, 'medium': 10, 'high': 20, 'extreme': 35 };
        return riskMap[result.rows[0].risk_level] || 5;
    } catch (error) {
        return 3;
    }
}

/**
 * Calcula probabilidad de inundación para un enlace
 */
async function calculateEdgeFloodProbability(client, edge) {
    // Enlaces más largos y en zonas costeras tienen más riesgo
    const lengthKm = edge.length / 1000;
    const lat = edge.center_lat;

    let baseRisk = 4;
    if (lat < -40) baseRisk = 10;
    else if (lat < -35) baseRisk = 7;
    else if (lat > -25) baseRisk = 6;

    // Añadir factor por longitud
    const lengthFactor = Math.min(1.5, 1 + (lengthKm / 100));

    return baseRisk * lengthFactor;
}

/**
 * Calcula probabilidad de eventos climáticos para un enlace
 */
async function calculateEdgeWeatherProbability(client, edge) {
    // Similar a nodos pero ajustado por longitud del enlace
    const lengthKm = edge.length / 1000;
    const baseRisk = 4;
    const lengthFactor = 1 + (lengthKm / 50); // Más largo = más expuesto

    return Math.min(20, baseRisk * lengthFactor);
}

/**
 * Calcula probabilidad de deslizamiento para un enlace
 */
async function calculateLandslideProbability(client, edge) {
    const lat = edge.center_lat;
    
    // Zonas montañosas (centro-sur) tienen más riesgo
    if (lat < -35 && lat > -40) {
        return 12; // Zona montañosa del sur
    } else if (lat < -32 && lat > -34) {
        return 8; // Zona central montañosa
    }
    
    return 3; // Bajo riesgo en otras zonas
}

/**
 * Obtiene factor de calidad de superficie
 */
function getSurfaceQualityFactor(surface) {
    const qualityMap = {
        'paved': 0.8,
        'asphalt': 0.8,
        'concrete': 0.7,
        'unpaved': 1.2,
        'gravel': 1.1,
        'dirt': 1.3,
        null: 1.0
    };

    return qualityMap[surface] || 1.0;
}

// ============================================================================
// FUNCIONES DE ESTADÍSTICAS
// ============================================================================

/**
 * Muestra estadísticas de probabilidades de nodos
 */
async function showNodeProbabilityStats(client) {
    console.log('\n📊 Estadísticas de probabilidades de nodos:');

    const stats = await client.query(`
        SELECT 
            AVG(earthquake_probability) as avg_earthquake,
            AVG(fire_probability) as avg_fire,
            AVG(flood_probability) as avg_flood,
            AVG(weather_probability) as avg_weather,
            AVG(total_failure_probability) as avg_total,
            MAX(total_failure_probability) as max_total,
            MIN(total_failure_probability) as min_total
        FROM node_probabilities
    `);

    const s = stats.rows[0];
    console.log(`   🌍 Terremoto: ${parseFloat(s.avg_earthquake).toFixed(2)}%`);
    console.log(`   🔥 Incendio: ${parseFloat(s.avg_fire).toFixed(2)}%`);
    console.log(`   💧 Inundación: ${parseFloat(s.avg_flood).toFixed(2)}%`);
    console.log(`   🌧️  Clima: ${parseFloat(s.avg_weather).toFixed(2)}%`);
    console.log(`   📈 Total promedio: ${parseFloat(s.avg_total).toFixed(2)}%`);
    console.log(`   ⬆️  Máximo: ${parseFloat(s.max_total).toFixed(2)}%`);
    console.log(`   ⬇️  Mínimo: ${parseFloat(s.min_total).toFixed(2)}%`);
}

/**
 * Muestra estadísticas de probabilidades de enlaces
 */
async function showEdgeProbabilityStats(client) {
    console.log('\n📊 Estadísticas de probabilidades de enlaces:');

    const stats = await client.query(`
        SELECT 
            AVG(earthquake_probability) as avg_earthquake,
            AVG(fire_probability) as avg_fire,
            AVG(flood_probability) as avg_flood,
            AVG(weather_probability) as avg_weather,
            AVG(landslide_probability) as avg_landslide,
            AVG(total_failure_probability) as avg_total,
            MAX(total_failure_probability) as max_total,
            MIN(total_failure_probability) as min_total
        FROM edge_probabilities
    `);

    const s = stats.rows[0];
    console.log(`   🌍 Terremoto: ${parseFloat(s.avg_earthquake).toFixed(2)}%`);
    console.log(`   🔥 Incendio: ${parseFloat(s.avg_fire).toFixed(2)}%`);
    console.log(`   💧 Inundación: ${parseFloat(s.avg_flood).toFixed(2)}%`);
    console.log(`   🌧️  Clima: ${parseFloat(s.avg_weather).toFixed(2)}%`);
    console.log(`   🏔️  Deslizamiento: ${parseFloat(s.avg_landslide).toFixed(2)}%`);
    console.log(`   📈 Total promedio: ${parseFloat(s.avg_total).toFixed(2)}%`);
    console.log(`   ⬆️  Máximo: ${parseFloat(s.max_total).toFixed(2)}%`);
    console.log(`   ⬇️  Mínimo: ${parseFloat(s.min_total).toFixed(2)}%`);
}

/**
 * Función principal
 */
async function main() {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL\n');

        await calculateAndLoadProbabilities();

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

module.exports = { calculateAndLoadProbabilities };
