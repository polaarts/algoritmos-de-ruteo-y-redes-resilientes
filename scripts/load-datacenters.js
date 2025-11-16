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
 * Genera datos sintéticos de datacenters para Chile
 */
function generateDatacenters() {
    return [
        {
            name: 'DC Santiago Centro - Equinix',
            company_name: 'Equinix',
            address: 'Av. Providencia 1234',
            city: 'Santiago',
            state: 'Región Metropolitana',
            country: 'Chile',
            lat: -33.4489,
            lon: -70.6693,
            capacity_mw: 5.0,
            tier_level: 4,
            year_opened: 2018,
            urban_density: 'high',
            population_5km: 300000
        },
        {
            name: 'DC Valparaíso - GTD',
            company_name: 'GTD',
            address: 'Av. Errázuriz 567',
            city: 'Valparaíso',
            state: 'Región de Valparaíso',
            country: 'Chile',
            lat: -33.0472,
            lon: -71.6127,
            capacity_mw: 3.0,
            tier_level: 3,
            year_opened: 2020,
            urban_density: 'high',
            population_5km: 150000
        },
        {
            name: 'DC Concepción - Telefónica',
            company_name: 'Telefónica',
            address: 'Av. O\'Higgins 890',
            city: 'Concepción',
            state: 'Región del Biobío',
            country: 'Chile',
            lat: -36.8201,
            lon: -73.0444,
            capacity_mw: 2.5,
            tier_level: 3,
            year_opened: 2019,
            urban_density: 'high',
            population_5km: 100000
        },
        {
            name: 'DC La Serena - Claro',
            company_name: 'Claro',
            address: 'Av. Francisco de Aguirre 234',
            city: 'La Serena',
            state: 'Región de Coquimbo',
            country: 'Chile',
            lat: -29.9027,
            lon: -71.2519,
            capacity_mw: 2.0,
            tier_level: 2,
            year_opened: 2021,
            urban_density: 'medium',
            population_5km: 80000
        },
        {
            name: 'DC Antofagasta - Entel',
            company_name: 'Entel',
            address: 'Av. Grecia 456',
            city: 'Antofagasta',
            state: 'Región de Antofagasta',
            country: 'Chile',
            lat: -23.6509,
            lon: -70.3975,
            capacity_mw: 2.0,
            tier_level: 2,
            year_opened: 2020,
            urban_density: 'medium',
            population_5km: 70000
        },
        {
            name: 'DC Temuco - VTR',
            company_name: 'VTR',
            address: 'Av. Alemania 789',
            city: 'Temuco',
            state: 'Región de La Araucanía',
            country: 'Chile',
            lat: -38.7359,
            lon: -72.5904,
            capacity_mw: 1.5,
            tier_level: 2,
            year_opened: 2021,
            urban_density: 'medium',
            population_5km: 60000
        },
        {
            name: 'DC Puerto Montt - WOM',
            company_name: 'WOM',
            address: 'Av. Diego Portales 123',
            city: 'Puerto Montt',
            state: 'Región de Los Lagos',
            country: 'Chile',
            lat: -41.4693,
            lon: -72.9424,
            capacity_mw: 1.5,
            tier_level: 2,
            year_opened: 2022,
            urban_density: 'medium',
            population_5km: 50000
        },
        {
            name: 'DC Arica - Entel',
            company_name: 'Entel',
            address: 'Av. Comandante San Martín 345',
            city: 'Arica',
            state: 'Región de Arica y Parinacota',
            country: 'Chile',
            lat: -18.4783,
            lon: -70.3126,
            capacity_mw: 1.0,
            tier_level: 2,
            year_opened: 2022,
            urban_density: 'medium',
            population_5km: 40000
        },
        {
            name: 'DC Iquique - GTD',
            company_name: 'GTD',
            address: 'Av. Arturo Prat 678',
            city: 'Iquique',
            state: 'Región de Tarapacá',
            country: 'Chile',
            lat: -20.2140,
            lon: -70.1522,
            capacity_mw: 1.0,
            tier_level: 2,
            year_opened: 2021,
            urban_density: 'medium',
            population_5km: 40000
        },
        {
            name: 'DC Punta Arenas - Telefónica',
            company_name: 'Telefónica',
            address: 'Av. Colón 901',
            city: 'Punta Arenas',
            state: 'Región de Magallanes',
            country: 'Chile',
            lat: -53.1638,
            lon: -70.9171,
            capacity_mw: 1.0,
            tier_level: 2,
            year_opened: 2020,
            urban_density: 'low',
            population_5km: 30000
        }
    ];
}

/**
 * Carga datacenters en la base de datos
 */
async function loadDatacenters() {
    console.log('\n' + '='.repeat(60));
    console.log('  CARGA DE DATACENTERS');
    console.log('='.repeat(60));

    const client = await pool.connect();

    try {
        const datacenters = generateDatacenters();
        console.log(`\n📊 Datacenters a cargar: ${datacenters.length}`);

        // Limpiar tabla
        await client.query('DELETE FROM datacenters');
        console.log('🗑️  Tabla datacenters limpiada');

        let inserted = 0;
        for (const dc of datacenters) {
            try {
                await client.query(`
                    INSERT INTO datacenters (
                        name, company_name, address, city, state, country,
                        capacity_mw, tier_level, year_opened, urban_density,
                        population_5km, geometry
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 
                              ST_SetSRID(ST_MakePoint($12, $13), 4326))
                `, [
                    dc.name,
                    dc.company_name,
                    dc.address,
                    dc.city,
                    dc.state,
                    dc.country,
                    dc.capacity_mw,
                    dc.tier_level,
                    dc.year_opened,
                    dc.urban_density,
                    dc.population_5km,
                    dc.lon,
                    dc.lat
                ]);

                inserted++;
                console.log(`✅ ${dc.name} - ${dc.city}`);
            } catch (error) {
                console.error(`❌ Error insertando ${dc.name}:`, error.message);
            }
        }

        console.log(`\n✅ Total datacenters insertados: ${inserted}/${datacenters.length}`);

        // Verificar
        const result = await client.query('SELECT COUNT(*) as count FROM datacenters');
        console.log(`📊 Datacenters en BD: ${result.rows[0].count}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Función principal
 */
async function main() {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL');

        await loadDatacenters();

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

module.exports = { loadDatacenters };
