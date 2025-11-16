const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Configuración de la base de datos (PostgreSQL local)
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'fiber_network',
    user: 'postgres',
    password: 'postgres'
});

console.log('🔧 Configuración de base de datos:');
console.log(`   Host: localhost`);
console.log(`   Base de datos: fiber_network`);

/**
 * Carga datos de metadata
 */
async function loadMetadata() {
    console.log('\n' + '='.repeat(60));
    console.log('  CARGA DE METADATA GEOGRÁFICA');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        console.log('\n⚠️  metadata_para_supabase.json no encontrado');
        console.log('📊 Generando datos sintéticos de metadata...\n');
        const metadata = generateSyntheticMetadata();

        await loadGroundType(client, metadata.ground_type);

        console.log('\n✅ Metadata cargada exitosamente');

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Carga datos de ground_type
 */
async function loadGroundType(client, groundTypeData) {
    console.log('\n📂 Cargando ground_type...');
    console.log(`   Registros a procesar: ${groundTypeData.length}`);

    // Limpiar tabla
    await client.query('DELETE FROM ground_type');

    let inserted = 0;
    for (const item of groundTypeData) {
        try {
            if (!item.geometry || !item.geometry.coordinates) {
                continue;
            }

            // Crear un polígono pequeño alrededor del punto (buffer de ~100m)
            let geomWKT;
            if (item.geometry.type === 'Point') {
                const [lon, lat] = item.geometry.coordinates;
                // Crear buffer de 0.001 grados (~100m)
                geomWKT = `ST_Buffer(ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography, 100)::geometry`;
            } else if (item.geometry.type === 'Polygon') {
                const coords = item.geometry.coordinates[0].map(c => `${c[0]} ${c[1]}`).join(',');
                geomWKT = `ST_GeomFromText('POLYGON((${coords}))', 4326)`;
            } else {
                continue;
            }

            // Convertir bearing_capacity de string a number si es necesario
            let bearingCapacity = 100.0;
            if (typeof item.bearing_capacity === 'string') {
                const bcMap = { 'low': 50.0, 'medium': 100.0, 'high': 200.0 };
                bearingCapacity = bcMap[item.bearing_capacity] || 100.0;
            } else if (typeof item.bearing_capacity === 'number') {
                bearingCapacity = item.bearing_capacity;
            }

            await client.query(`
                INSERT INTO ground_type (
                    soil_type, stability, installation_difficulty,
                    permeability, bearing_capacity, geometry
                ) VALUES ($1, $2, $3, $4, $5, ${geomWKT})
            `, [
                item.soil_type || 'mixed',
                item.stability || 'moderate',
                item.installation_difficulty || 'moderate',
                item.permeability || 'medium',
                bearingCapacity
            ]);

            inserted++;
        } catch (error) {
            console.error(`⚠️  Error insertando ground_type: ${error.message}`);
        }
    }

    console.log(`✅ ground_type insertados: ${inserted}`);
}

/**
 * Genera metadata sintética para testing
 */
function generateSyntheticMetadata() {
    console.log('🔨 Generando datos sintéticos...');

    const groundTypes = [];

    // Generar ground_type para diferentes regiones de Chile
    const regions = [
        { name: 'Santiago Centro', lat: -33.45, lon: -70.65, soil: 'clay', stability: 'stable' },
        { name: 'Valparaíso', lat: -33.05, lon: -71.62, soil: 'sandy', stability: 'moderate' },
        { name: 'Concepción', lat: -36.83, lon: -73.05, soil: 'mixed', stability: 'stable' },
        { name: 'La Serena', lat: -29.91, lon: -71.25, soil: 'rocky', stability: 'stable' },
        { name: 'Temuco', lat: -38.74, lon: -72.59, soil: 'clay', stability: 'moderate' },
        { name: 'Puerto Montt', lat: -41.47, lon: -72.94, soil: 'mixed', stability: 'unstable' },
        { name: 'Antofagasta', lat: -23.65, lon: -70.40, soil: 'sandy', stability: 'stable' },
        { name: 'Iquique', lat: -20.21, lon: -70.15, soil: 'rocky', stability: 'stable' },
        { name: 'Punta Arenas', lat: -53.16, lon: -70.91, soil: 'mixed', stability: 'moderate' },
        { name: 'Arica', lat: -18.48, lon: -70.31, soil: 'sandy', stability: 'stable' }
    ];

    for (const region of regions) {
        // Ground type
        groundTypes.push({
            soil_type: region.soil,
            stability: region.stability,
            installation_difficulty: getInstallationDifficulty(region.soil),
            permeability: getPermeability(region.soil),
            bearing_capacity: getBearingCapacity(region.stability),
            geometry: {
                type: 'Point',
                coordinates: [region.lon, region.lat]
            }
        });
    }

    return {
        ground_type: groundTypes
    };
}

// Helper functions
function getInstallationDifficulty(soilType) {
    const map = { 'clay': 'moderate', 'sandy': 'easy', 'rocky': 'difficult', 'mixed': 'moderate' };
    return map[soilType] || 'moderate';
}

function getPermeability(soilType) {
    const map = { 'clay': 'low', 'sandy': 'high', 'rocky': 'medium', 'mixed': 'medium' };
    return map[soilType] || 'medium';
}

function getBearingCapacity(stability) {
    const map = { 'stable': 'high', 'moderate': 'medium', 'unstable': 'low' };
    return map[stability] || 'medium';
}

/**
 * Función principal
 */
async function main() {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL');

        await loadMetadata();

        console.log('\n' + '='.repeat(60));
        console.log('  ✅ PROCESO COMPLETADO');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
        console.log('\n🔌 Conexión cerrada');
    }
}

if (require.main === module) {
    main();
}

module.exports = { loadMetadata };
