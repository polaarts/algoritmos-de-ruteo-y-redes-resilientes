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
console.log(`   Puerto: ${process.env.DB_PORT}`);
console.log(`   Base de datos: ${process.env.DB_NAME}`);
console.log(`   Usuario: ${process.env.DB_USER}`);

/**
 * Estima el tier level basado en el nombre y compañía
 */
function estimateTierLevel(name, company) {
    const nameLower = name.toLowerCase();
    const companyLower = company ? company.toLowerCase() : '';
    
    // Compañías tier 3-4 conocidas
    const tier34Companies = ['ascenty', 'equinix', 'gtd', 'telefonica', 'claro'];
    
    // Palabras clave en el nombre
    if (nameLower.includes('tier 3') || nameLower.includes('tier3') || 
        nameLower.includes('tier 4') || nameLower.includes('tier4')) {
        return 4;
    }
    
    if (tier34Companies.some(comp => companyLower.includes(comp))) {
        return 3;
    }
    
    // Por defecto tier 2
    return 2;
}

/**
 * Estima capacidad en MW basado en el nombre y compañía
 */
function estimateCapacity(name, company) {
    const companyLower = company ? company.toLowerCase() : '';
    
    // Datacenters grandes conocidos
    const largeCompanies = ['ascenty', 'equinix', 'gtd'];
    
    if (largeCompanies.some(comp => companyLower.includes(comp))) {
        return 5.0;  // ~5 MW para DCs grandes
    }
    
    // Datacenters medianos
    return 2.0;  // ~2 MW por defecto
}

/**
 * Estima población cercana y densidad urbana basado en la ciudad
 */
function estimatePopulation(city) {
    const cityData = {
        'santiago': { population: 300000, density: 'high' },
        'valparaíso': { population: 150000, density: 'high' },
        'concepción': { population: 100000, density: 'high' },
        'viña del mar': { population: 120000, density: 'high' },
        'la serena': { population: 80000, density: 'medium' },
        'antofagasta': { population: 70000, density: 'medium' },
        'temuco': { population: 60000, density: 'medium' },
        'puerto montt': { population: 50000, density: 'medium' },
        'arica': { population: 40000, density: 'medium' },
        'iquique': { population: 40000, density: 'medium' },
        'talca': { population: 50000, density: 'medium' },
        'chillán': { population: 40000, density: 'medium' },
        'osorno': { population: 35000, density: 'low' },
        'valdivia': { population: 45000, density: 'medium' },
        'punta arenas': { population: 30000, density: 'low' },
    };
    
    const cityLower = city ? city.toLowerCase() : 'unknown';
    
    for (const [key, value] of Object.entries(cityData)) {
        if (cityLower.includes(key)) {
            return value;
        }
    }
    
    // Por defecto
    return { population: 50000, density: 'medium' };
}

/**
 * Estima año de apertura (aproximado)
 */
function normalizeYearOpened(name, company) {
    const companyLower = company ? company.toLowerCase() : '';
    
    // Compañías que llegaron más recientemente
    if (companyLower.includes('ascenty')) {
        return 2019;
    } else if (companyLower.includes('equinix')) {
        return 2020;
    } else if (companyLower.includes('gtd')) {
        return 2016;
    }
    
    // Por defecto
    return 2018;
}

/**
 * Carga datacenters normalizados desde GeoJSON
 */
async function loadDatacenters(filepath) {
    console.log(`\n📂 Cargando datacenters desde ${filepath}...`);
    
    // Verificar que el archivo existe
    try {
        await fs.access(filepath);
    } catch (error) {
        console.error(`⚠️  Archivo no encontrado: ${filepath}`);
        return 0;
    }
    
    // Leer el archivo GeoJSON
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    
    const features = data.features || [];
    console.log(`📊 Encontrados ${features.length} datacenters`);
    
    const client = await pool.connect();
    
    try {
        // Limpiar tabla (opcional)
        console.log('🗑️  Limpiando tabla datacenters...');
        await client.query('DELETE FROM datacenters');
        
        let inserted = 0;
        let errors = 0;
        
        // Insertar cada datacenter
        for (let idx = 0; idx < features.length; idx++) {
            const feature = features[idx];
            
            try {
                const props = feature.properties || {};
                const geom = feature.geometry || {};
                
                if (geom.type !== 'Point') {
                    console.warn(`⚠️  Datacenter ${idx}: geometría no es Point`);
                    continue;
                }
                
                const coords = geom.coordinates || [];
                if (coords.length !== 2) {
                    console.warn(`⚠️  Datacenter ${idx}: coordenadas inválidas`);
                    continue;
                }
                
                const [lon, lat] = coords;
                
                // Extraer datos básicos
                const name = props.name || `Datacenter ${idx}`;
                const company = props.company_name || 'Unknown';
                const address = props.address || '';
                const city = props.city || 'Unknown';
                const state = props.state || 'Unknown';
                const country = props.country || 'Chile';
                
                // Normalizar campos adicionales
                const capacity_mw = estimateCapacity(name, company);
                const tier_level = estimateTierLevel(name, company);
                const year_opened = normalizeYearOpened(name, company);
                const { population, density } = estimatePopulation(city);
                
                // Insertar en la base de datos
                await client.query(`
                    INSERT INTO datacenters (
                        name, company_name, address, city, state, country,
                        capacity_mw, tier_level, year_opened,
                        urban_density, population_5km,
                        geometry
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6,
                        $7, $8, $9,
                        $10, $11,
                        ST_SetSRID(ST_MakePoint($12, $13), 4326)
                    )
                `, [
                    name, company, address, city, state, country,
                    capacity_mw, tier_level, year_opened,
                    density, population,
                    lon, lat
                ]);
                
                inserted++;
                
                if (inserted % 10 === 0) {
                    console.log(`  ✓ Insertados ${inserted} / ${features.length} datacenters...`);
                }
                
            } catch (error) {
                errors++;
                console.error(`⚠️  Error en datacenter ${idx} (${feature.properties?.name || 'unknown'}): ${error.message}`);
                continue;
            }
        }
        
        console.log(`\n✅ Datacenters cargados:`);
        console.log(`   • Insertados: ${inserted}`);
        console.log(`   • Errores: ${errors}`);
        
        return inserted;
        
    } finally {
        client.release();
    }
}

/**
 * Verifica los datos cargados
 */
async function verifyData() {
    console.log('\n🔍 Verificando datos cargados...');
    
    const client = await pool.connect();
    
    try {
        // Total de datacenters
        const totalResult = await client.query('SELECT COUNT(*) FROM datacenters');
        const total = parseInt(totalResult.rows[0].count);
        console.log(`   • Total de datacenters: ${total}`);
        
        // Por ciudad
        const cityResult = await client.query(`
            SELECT city, COUNT(*) as count 
            FROM datacenters 
            GROUP BY city 
            ORDER BY count DESC 
            LIMIT 5
        `);
        console.log(`\n   📍 Top 5 ciudades:`);
        cityResult.rows.forEach(row => {
            console.log(`      • ${row.city}: ${row.count} datacenters`);
        });
        
        // Por compañía
        const companyResult = await client.query(`
            SELECT company_name, COUNT(*) as count 
            FROM datacenters 
            GROUP BY company_name 
            ORDER BY count DESC 
            LIMIT 5
        `);
        console.log(`\n   🏢 Top 5 compañías:`);
        companyResult.rows.forEach(row => {
            console.log(`      • ${row.company_name}: ${row.count} datacenters`);
        });
        
        // Por tier level
        const tierResult = await client.query(`
            SELECT tier_level, COUNT(*) as count 
            FROM datacenters 
            GROUP BY tier_level 
            ORDER BY tier_level
        `);
        console.log(`\n   ⭐ Por Tier Level:`);
        tierResult.rows.forEach(row => {
            console.log(`      • Tier ${row.tier_level}: ${row.count} datacenters`);
        });
        
    } finally {
        client.release();
    }
}

/**
 * Función principal
 */
async function main() {
    console.log('='.repeat(60));
    console.log('  CARGA DE DATACENTERS A POSTGRESQL/SUPABASE');
    console.log('='.repeat(60));
    
    try {
        // Conectar
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL\n');
        
        // Cargar datacenters
        const total = await loadDatacenters(
            path.join(__dirname, '..', 'infraestructura', 'datacenters.geojson')
        );
        
        if (total > 0) {
            // Verificar datos
            await verifyData();
        }
        
        // Resumen
        console.log('\n' + '='.repeat(60));
        console.log('  ✅ CARGA COMPLETADA');
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

// Ejecutar
if (require.main === module) {
    main();
}

module.exports = { loadDatacenters };
