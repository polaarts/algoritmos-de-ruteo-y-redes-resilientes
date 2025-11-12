/**
 * Script para cargar datos adaptados a Supabase
 * 
 * Carga los datos de amenazas y metadata que fueron adaptados
 * a los formatos correctos de las tablas en Supabase
 */

const fs = require('fs').promises;
const path = require('path');

// Determinar la ruta del proyecto
const projectRoot = path.join(__dirname, '..');
const backendPath = path.join(projectRoot, 'backend');

// Cargar variables de entorno desde backend/.env
require('dotenv').config({ path: path.join(backendPath, '.env') });

// Importar Supabase client directamente
const { createClient } = require('@supabase/supabase-js');

// Crear cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

const dbConfig = { supabase };

async function cargarAmenazas() {
    console.log('\n📊 CARGANDO AMENAZAS A SUPABASE\n');
    console.log('='.repeat(50));
    
    const amenazasPath = path.join(projectRoot, 'amenazas', 'amenazas_para_supabase.json');
    
    try {
        const contenido = await fs.readFile(amenazasPath, 'utf-8');
        const datos = JSON.parse(contenido);
        
        let totalInsertados = 0;
        let totalErrores = 0;
        
        // ============================================================================
        // CARGAR SISMOS (earthquakes)
        // ============================================================================
        if (datos.earthquakes && datos.earthquakes.length > 0) {
            console.log(`\n▶ Insertando ${datos.earthquakes.length} sismos...`);
            
            try {
                const { data, error } = await dbConfig.supabase
                    .from('earthquakes')
                    .insert(datos.earthquakes.map(eq => ({
                        usgs_id: eq.usgs_id,
                        magnitude: eq.magnitude,
                        depth: eq.depth,
                        time: eq.time,
                        place: eq.place,
                        geometry: `POINT(${eq.geometry.coordinates[0]} ${eq.geometry.coordinates[1]})`
                    })))
                    .select();
                
                if (error) {
                    console.error('❌ Error al insertar sismos:', error.message);
                    totalErrores += datos.earthquakes.length;
                } else {
                    console.log(`✅ ${data.length} sismos insertados correctamente`);
                    totalInsertados += data.length;
                }
            } catch (err) {
                console.error('❌ Error:', err.message);
                totalErrores += datos.earthquakes.length;
            }
        }
        
        // ============================================================================
        // CARGAR ZONAS DE RIESGO DE INCENDIO (fire_risk_zones)
        // ============================================================================
        if (datos.fire_risk_zones && datos.fire_risk_zones.length > 0) {
            console.log(`\n▶ Insertando ${datos.fire_risk_zones.length} zonas de riesgo...`);
            
            try {
                const { data, error } = await dbConfig.supabase
                    .from('fire_risk_zones')
                    .insert(datos.fire_risk_zones.map(zone => {
                        // Convertir coordenadas del polígono a formato WKT
                        const coords = zone.geometry.coordinates[0];
                        const wktCoords = coords.map(c => `${c[0]} ${c[1]}`).join(', ');
                        
                        return {
                            zone_name: zone.zone_name,
                            risk_level: zone.risk_level,
                            vegetation_type: zone.vegetation_type,
                            area_km2: zone.area_km2,
                            fire_frequency: zone.fire_frequency,
                            last_fire_date: zone.last_fire_date,
                            high_risk_months: zone.high_risk_months,
                            geometry: `POLYGON((${wktCoords}))`
                        };
                    }))
                    .select();
                
                if (error) {
                    console.error('❌ Error al insertar zonas de riesgo:', error.message);
                    totalErrores += datos.fire_risk_zones.length;
                } else {
                    console.log(`✅ ${data.length} zonas de riesgo insertadas correctamente`);
                    totalInsertados += data.length;
                }
            } catch (err) {
                console.error('❌ Error:', err.message);
                totalErrores += datos.fire_risk_zones.length;
            }
        }
        
        // ============================================================================
        // CARGAR EVENTOS CLIMÁTICOS (weather_events)
        // ============================================================================
        if (datos.weather_events && datos.weather_events.length > 0) {
            console.log(`\n▶ Insertando ${datos.weather_events.length} eventos climáticos...`);
            
            try {
                const { data, error} = await dbConfig.supabase
                    .from('weather_events')
                    .insert(datos.weather_events.map(event => {
                        // Convertir coordenadas del polígono a formato WKT
                        const coords = event.geometry.coordinates[0];
                        const wktCoords = coords.map(c => `${c[0]} ${c[1]}`).join(', ');
                        
                        return {
                            event_type: event.event_type,
                            severity: event.severity,
                            event_date: event.event_date,
                            duration_hours: event.duration_hours,
                            max_wind_speed: event.max_wind_speed,
                            precipitation_mm: event.precipitation_mm,
                            temperature_c: event.temperature_c,
                            description: event.description,
                            infrastructure_damage: event.infrastructure_damage,
                            geometry: `POLYGON((${wktCoords}))`
                        };
                    }))
                    .select();
                
                if (error) {
                    console.error('❌ Error al insertar eventos climáticos:', error.message);
                    totalErrores += datos.weather_events.length;
                } else {
                    console.log(`✅ ${data.length} eventos climáticos insertados correctamente`);
                    totalInsertados += data.length;
                }
            } catch (err) {
                console.error('❌ Error:', err.message);
                totalErrores += datos.weather_events.length;
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`📊 Resumen de carga de amenazas:`);
        console.log(`   ✅ Insertados: ${totalInsertados}`);
        console.log(`   ❌ Errores: ${totalErrores}`);
        
        return { insertados: totalInsertados, errores: totalErrores };
        
    } catch (error) {
        console.error('❌ Error al cargar amenazas:', error.message);
        return { insertados: 0, errores: -1 };
    }
}

async function cargarMetadata() {
    console.log('\n📊 CARGANDO METADATA A SUPABASE\n');
    console.log('='.repeat(50));
    
    const metadataPath = path.join(projectRoot, 'metadata', 'metadata_para_supabase.json');
    
    try {
        const contenido = await fs.readFile(metadataPath, 'utf-8');
        const datos = JSON.parse(contenido);
        
        let totalInsertados = 0;
        let totalErrores = 0;
        
        // ============================================================================
        // CARGAR TIPOS DE SUELO (ground_type)
        // ============================================================================
        if (datos.ground_type && datos.ground_type.length > 0) {
            console.log(`\n▶ Insertando ${datos.ground_type.length} tipos de suelo...`);
            
            // Filtrar los que tienen geometría
            const conGeometria = datos.ground_type.filter(gt => gt.geometry);
            console.log(`   (${conGeometria.length} con geometría válida)`);
            
            if (conGeometria.length > 0) {
                try {
                    const { data, error } = await dbConfig.supabase
                        .from('ground_type')
                        .insert(conGeometria.map(gt => ({
                            soil_type: gt.soil_type,
                            stability: gt.stability,
                            installation_difficulty: gt.installation_difficulty,
                            permeability: gt.permeability,
                            bearing_capacity: gt.bearing_capacity,
                            geometry: `POINT(${gt.geometry.coordinates[0]} ${gt.geometry.coordinates[1]})`
                        })))
                        .select();
                    
                    if (error) {
                        console.error('❌ Error al insertar tipos de suelo:', error.message);
                        totalErrores += conGeometria.length;
                    } else {
                        console.log(`✅ ${data.length} tipos de suelo insertados correctamente`);
                        totalInsertados += data.length;
                    }
                } catch (err) {
                    console.error('❌ Error:', err.message);
                    totalErrores += conGeometria.length;
                }
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log(`📊 Resumen de carga de metadata:`);
        console.log(`   ✅ Insertados: ${totalInsertados}`);
        console.log(`   ❌ Errores: ${totalErrores}`);
        console.log(`\nℹ️  Nota: Los datos de vías (fiber_links) requieren nodos existentes`);
        console.log(`   y se deben cargar después de crear la topología de red.`);
        
        return { insertados: totalInsertados, errores: totalErrores };
        
    } catch (error) {
        console.error('❌ Error al cargar metadata:', error.message);
        return { insertados: 0, errores: -1 };
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  CARGA DE DATOS A SUPABASE                     ║');
    console.log('║  Amenazas + Metadata                           ║');
    console.log('╚════════════════════════════════════════════════╝');
    
    // Verificar conexión a Supabase
    if (!dbConfig.supabase) {
        console.error('\n❌ No se pudo conectar a Supabase');
        console.error('   Verifica las variables de entorno en backend/config/database.js');
        process.exit(1);
    }
    
    console.log('\n✓ Conexión a Supabase establecida');
    
    // Cargar amenazas
    const resultadoAmenazas = await cargarAmenazas();
    
    // Cargar metadata
    const resultadoMetadata = await cargarMetadata();
    
    // Resumen final
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RESUMEN TOTAL DE CARGA');
    console.log('='.repeat(60));
    console.log(`Total registros insertados: ${resultadoAmenazas.insertados + resultadoMetadata.insertados}`);
    console.log(`Total errores: ${resultadoAmenazas.errores + resultadoMetadata.errores}`);
    console.log('='.repeat(60) + '\n');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { cargarAmenazas, cargarMetadata };
