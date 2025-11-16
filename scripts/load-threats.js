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
 * Genera eventos climáticos sintéticos para Chile
 */
function generateWeatherEvents() {
    const events = [];
    const regions = [
        { name: 'Santiago', lat: -33.45, lon: -70.65, box: 0.3 },
        { name: 'Valparaíso', lat: -33.05, lon: -71.62, box: 0.2 },
        { name: 'Concepción', lat: -36.83, lon: -73.05, box: 0.2 },
        { name: 'Temuco', lat: -38.74, lon: -72.59, box: 0.2 },
        { name: 'Puerto Montt', lat: -41.47, lon: -72.94, box: 0.2 }
    ];

    const eventTypes = [
        { type: 'heavy_rain', severity: 'high', wind: 60, precip: 150, temp: 15, damage: 'moderate' },
        { type: 'storm', severity: 'high', wind: 100, precip: 80, temp: 12, damage: 'high' },
        { type: 'heat_wave', severity: 'medium', wind: 20, precip: 0, temp: 38, damage: 'low' },
        { type: 'cold_wave', severity: 'medium', wind: 40, precip: 5, temp: -5, damage: 'low' },
        { type: 'drought', severity: 'medium', wind: 15, precip: 0, temp: 28, damage: 'low' }
    ];

    // Generar eventos para los últimos 2 años
    const baseDate = new Date('2023-01-01');
    for (let i = 0; i < 50; i++) {
        const region = regions[Math.floor(Math.random() * regions.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        // Fecha aleatoria en los últimos 2 años
        const daysOffset = Math.floor(Math.random() * 730);
        const eventDate = new Date(baseDate);
        eventDate.setDate(eventDate.getDate() + daysOffset);

        events.push({
            event_type: eventType.type,
            severity: eventType.severity,
            event_date: eventDate.toISOString().split('T')[0],
            duration_hours: Math.floor(Math.random() * 48) + 12,
            max_wind_speed: eventType.wind + (Math.random() * 20 - 10),
            precipitation_mm: eventType.precip + (Math.random() * 30 - 15),
            temperature_c: eventType.temp + (Math.random() * 5 - 2.5),
            affected_population: Math.floor(Math.random() * 50000) + 10000,
            infrastructure_damage: eventType.damage,
            description: `${eventType.type.replace('_', ' ')} en ${region.name}`,
            region: region,
            box: region.box
        });
    }

    return events;
}

/**
 * Genera zonas de riesgo de incendio para Chile
 */
function generateFireRiskZones() {
    return [
        {
            zone_name: 'Zona Central - Región Metropolitana',
            risk_level: 'high',
            vegetation_type: 'matorral',
            area_km2: 450.0,
            high_risk_months: [11, 12, 1, 2],
            last_fire_date: '2024-01-15',
            fire_frequency: 8,
            lat: -33.45,
            lon: -70.65,
            box: 0.5
        },
        {
            zone_name: 'Valparaíso - Cerros',
            risk_level: 'very_high',
            vegetation_type: 'matorral',
            area_km2: 320.0,
            high_risk_months: [11, 12, 1, 2, 3],
            last_fire_date: '2024-02-10',
            fire_frequency: 12,
            lat: -33.05,
            lon: -71.62,
            box: 0.4
        },
        {
            zone_name: 'Biobío - Cordillera',
            risk_level: 'high',
            vegetation_type: 'bosque',
            area_km2: 580.0,
            high_risk_months: [12, 1, 2],
            last_fire_date: '2023-12-20',
            fire_frequency: 6,
            lat: -36.83,
            lon: -73.05,
            box: 0.6
        },
        {
            zone_name: 'La Araucanía - Bosques',
            risk_level: 'medium',
            vegetation_type: 'bosque',
            area_km2: 720.0,
            high_risk_months: [12, 1, 2],
            last_fire_date: '2023-11-15',
            fire_frequency: 4,
            lat: -38.74,
            lon: -72.59,
            box: 0.7
        },
        {
            zone_name: 'Coquimbo - Valle',
            risk_level: 'high',
            vegetation_type: 'matorral',
            area_km2: 390.0,
            high_risk_months: [10, 11, 12, 1],
            last_fire_date: '2024-01-05',
            fire_frequency: 7,
            lat: -29.91,
            lon: -71.25,
            box: 0.5
        },
        {
            zone_name: 'Maule - Precordillera',
            risk_level: 'high',
            vegetation_type: 'bosque',
            area_km2: 510.0,
            high_risk_months: [11, 12, 1, 2],
            last_fire_date: '2024-01-28',
            fire_frequency: 9,
            lat: -35.43,
            lon: -71.67,
            box: 0.6
        }
    ];
}

/**
 * Carga eventos climáticos en la base de datos
 */
async function loadWeatherEvents(client) {
    console.log('\n📂 Cargando weather_events...');
    
    const events = generateWeatherEvents();
    console.log(`   Eventos a cargar: ${events.length}`);

    // Limpiar tabla
    await client.query('DELETE FROM weather_events');

    let inserted = 0;
    for (const event of events) {
        try {
            // Crear un polígono (bounding box) alrededor del punto
            const minLon = event.region.lon - event.box / 2;
            const maxLon = event.region.lon + event.box / 2;
            const minLat = event.region.lat - event.box / 2;
            const maxLat = event.region.lat + event.box / 2;

            const polygon = `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;

            await client.query(`
                INSERT INTO weather_events (
                    event_type, severity, event_date, duration_hours,
                    max_wind_speed, precipitation_mm, temperature_c,
                    affected_population, infrastructure_damage, description, geometry
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
                          ST_GeomFromText($11, 4326))
            `, [
                event.event_type,
                event.severity,
                event.event_date,
                event.duration_hours,
                event.max_wind_speed,
                event.precipitation_mm,
                event.temperature_c,
                event.affected_population,
                event.infrastructure_damage,
                event.description,
                polygon
            ]);

            inserted++;
        } catch (error) {
            console.error(`⚠️  Error insertando evento: ${error.message}`);
        }
    }

    console.log(`✅ weather_events insertados: ${inserted}`);
}

/**
 * Carga zonas de riesgo de incendio en la base de datos
 */
async function loadFireRiskZones(client) {
    console.log('\n📂 Cargando fire_risk_zones...');
    
    const zones = generateFireRiskZones();
    console.log(`   Zonas a cargar: ${zones.length}`);

    // Limpiar tabla
    await client.query('DELETE FROM fire_risk_zones');

    let inserted = 0;
    for (const zone of zones) {
        try {
            // Crear un polígono (bounding box) para la zona
            const minLon = zone.lon - zone.box / 2;
            const maxLon = zone.lon + zone.box / 2;
            const minLat = zone.lat - zone.box / 2;
            const maxLat = zone.lat + zone.box / 2;

            const polygon = `POLYGON((${minLon} ${minLat}, ${maxLon} ${minLat}, ${maxLon} ${maxLat}, ${minLon} ${maxLat}, ${minLon} ${minLat}))`;

            await client.query(`
                INSERT INTO fire_risk_zones (
                    zone_name, risk_level, vegetation_type, area_km2,
                    high_risk_months, last_fire_date, fire_frequency, geometry
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, ST_GeomFromText($8, 4326))
            `, [
                zone.zone_name,
                zone.risk_level,
                zone.vegetation_type,
                zone.area_km2,
                zone.high_risk_months,
                zone.last_fire_date,
                zone.fire_frequency,
                polygon
            ]);

            inserted++;
            console.log(`✅ ${zone.zone_name} - ${zone.risk_level}`);
        } catch (error) {
            console.error(`⚠️  Error insertando zona: ${error.message}`);
        }
    }

    console.log(`✅ fire_risk_zones insertadas: ${inserted}`);
}

/**
 * Función principal
 */
async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  CARGA DE AMENAZAS (WEATHER & FIRE RISKS)');
    console.log('='.repeat(60));

    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Conectado a PostgreSQL');

        const client = await pool.connect();
        
        try {
            await loadWeatherEvents(client);
            await loadFireRiskZones(client);

            // Verificar
            const weatherCount = await client.query('SELECT COUNT(*) as count FROM weather_events');
            const fireCount = await client.query('SELECT COUNT(*) as count FROM fire_risk_zones');
            
            console.log('\n📊 Resumen:');
            console.log(`   - Weather events: ${weatherCount.rows[0].count}`);
            console.log(`   - Fire risk zones: ${fireCount.rows[0].count}`);

        } finally {
            client.release();
        }

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

module.exports = { loadWeatherEvents, loadFireRiskZones };
