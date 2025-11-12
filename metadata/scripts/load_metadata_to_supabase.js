const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

// Configuración de la base de datos
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});

console.log('🔧 Configuración de base de datos:');
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   Base de datos: ${process.env.DB_NAME}`);

/**
 * Carga datos de metadata a Supabase
 */
async function loadMetadata() {
    console.log('\n' + '='.repeat(60));
    console.log('  CARGA DE METADATA GEOGRÁFICA A SUPABASE');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        // Verificar si existe metadata_para_supabase.json
        const metadataPath = path.join(__dirname, '..', 'metadata', 'metadata_para_supabase.json');
        let metadata;

        try {
            const content = await fs.readFile(metadataPath, 'utf-8');
            metadata = JSON.parse(content);
            console.log('\n✅ Archivo metadata_para_supabase.json encontrado');
        } catch (error) {
            console.log('\n⚠️  metadata_para_supabase.json no encontrado');
            console.log('📊 Generando datos sintéticos de metadata...\n');
            metadata = generateSyntheticMetadata();
        }

        // Verificar si hay datos con geometría válida
        const validGroundType = metadata.ground_type?.filter(item => 
            item.geometry && item.geometry.coordinates
        ) || [];

        console.log(`   Ground type con geometría válida: ${validGroundType.length} / ${metadata.ground_type?.length || 0}`);

        if (validGroundType.length === 0) {
            console.log('\n⚠️  No hay ground_type con geometría válida');
            console.log('📊 Generando datos sintéticos...');
            const synthetic = generateSyntheticMetadata();
            await loadGroundType(client, synthetic.ground_type);
        } else {
            await loadGroundType(client, validGroundType);
        }

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
 * Carga datos de infrastructure metadata (no implementado - tabla no existe)
 */
async function loadInfrastructureMetadata(client, infraData) {
    console.log('\n⚠️  Tabla infrastructure_metadata no existe en el schema');
    console.log('   Omitiendo carga de infrastructure metadata');
    return 0;
}

/**
 * Genera metadata sintética para testing
 */
function generateSyntheticMetadata() {
    console.log('🔨 Generando datos sintéticos...');

    const groundTypes = [];
    const infraMetadata = [];

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

        // Infrastructure metadata
        infraMetadata.push({
            name: `Infraestructura ${region.name}`,
            metadata_type: 'urban',
            category: 'infrastructure',
            description: `Zona urbana de ${region.name}`,
            accessibility: getAccessibility(region.name),
            urban_density: getUrbanDensity(region.name),
            population_density: getPopulationDensity(region.name),
            terrain_type: getTerrainType(region.name),
            geometry: {
                type: 'Point',
                coordinates: [region.lon, region.lat]
            }
        });
    }

    return {
        ground_type: groundTypes,
        infrastructure_metadata: infraMetadata
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

function getAccessibility(cityName) {
    const urban = ['Santiago Centro', 'Valparaíso', 'Concepción'];
    return urban.includes(cityName) ? 'high' : 'medium';
}

function getUrbanDensity(cityName) {
    const high = ['Santiago Centro', 'Valparaíso'];
    const medium = ['Concepción', 'La Serena', 'Antofagasta'];
    if (high.includes(cityName)) return 'high';
    if (medium.includes(cityName)) return 'medium';
    return 'low';
}

function getPopulationDensity(cityName) {
    const densities = {
        'Santiago Centro': 150000,
        'Valparaíso': 100000,
        'Concepción': 80000,
        'La Serena': 60000,
        'Temuco': 50000,
        'Puerto Montt': 40000,
        'Antofagasta': 70000,
        'Iquique': 50000
    };
    return densities[cityName] || 50000;
}

function getTerrainType(cityName) {
    const coastal = ['Valparaíso', 'Antofagasta', 'Iquique'];
    const mountain = ['Santiago Centro'];
    if (coastal.includes(cityName)) return 'coastal';
    if (mountain.includes(cityName)) return 'mixed';
    return 'flat';
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
