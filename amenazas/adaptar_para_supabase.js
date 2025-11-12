const fs = require('fs').promises;
const path = require('path');

/**
 * Adapta los datos de amenazas al formato de la base de datos
 */

async function adaptarDatosAmenazas() {
    console.log('📊 Adaptando datos de amenazas para Supabase...\n');

    // Leer el archivo de datos integrados
    const datosPath = path.join(__dirname, 'datos_integrados.json');
    let datos;
    
    try {
        const contenido = await fs.readFile(datosPath, 'utf-8');
        datos = JSON.parse(contenido);
    } catch (error) {
        console.error('❌ Error al leer datos_integrados.json:', error.message);
        return null;
    }

    const resultado = {
        earthquakes: [],
        fire_risk_zones: [],
        weather_events: []
    };

    // ============================================================================
    // ADAPTAR SISMOS → earthquakes
    // ============================================================================
    if (datos.sismicidad && Array.isArray(datos.sismicidad)) {
        console.log(`▶ Procesando ${datos.sismicidad.length} sismos...`);
        
        resultado.earthquakes = datos.sismicidad.map(sismo => ({
            usgs_id: sismo.url ? sismo.url.split('/').pop() : null,
            magnitude: sismo.magnitud,
            depth: null, // No viene en los datos actuales
            time: sismo.fecha,
            place: sismo.ubicacion,
            geometry: {
                type: 'Point',
                coordinates: [sismo.lon, sismo.lat]
            }
            // threat_level se calcula automáticamente en el trigger
        }));
        
        console.log(`✓ ${resultado.earthquakes.length} sismos adaptados`);
    }

    // ============================================================================
    // ADAPTAR INCENDIOS → fire_risk_zones
    // ============================================================================
    if (datos.incendios_forestales && Array.isArray(datos.incendios_forestales)) {
        console.log(`\n▶ Procesando ${datos.incendios_forestales.length} incendios...`);
        
        // Agrupar incendios por región/comuna para crear zonas de riesgo
        const zonasPorComuna = {};
        
        datos.incendios_forestales.forEach(incendio => {
            const key = `${incendio.region}_${incendio.comuna}`;
            
            if (!zonasPorComuna[key]) {
                zonasPorComuna[key] = {
                    zone_name: `${incendio.comuna}, ${incendio.region}`,
                    region: incendio.region,
                    comuna: incendio.comuna,
                    incendios: [],
                    superficie_total: 0,
                    causas: new Set(),
                    temporadas: new Set()
                };
            }
            
            zonasPorComuna[key].incendios.push(incendio);
            zonasPorComuna[key].superficie_total += incendio.superficie_ha || 0;
            if (incendio.causa) zonasPorComuna[key].causas.add(incendio.causa);
            if (incendio.temporada) zonasPorComuna[key].temporadas.add(incendio.temporada);
        });
        
        // Convertir a formato de fire_risk_zones
        resultado.fire_risk_zones = Object.values(zonasPorComuna).map(zona => {
            const numIncendios = zona.incendios.length;
            const superficiePromedio = zona.superficie_total / numIncendios;
            
            // Calcular nivel de riesgo basado en frecuencia y superficie
            let riskLevel = 'low';
            if (numIncendios >= 10 && superficiePromedio > 50) {
                riskLevel = 'extreme';
            } else if (numIncendios >= 5 && superficiePromedio > 20) {
                riskLevel = 'high';
            } else if (numIncendios >= 3) {
                riskLevel = 'medium';
            }
            
            // Obtener coordenadas del primer incendio como referencia
            const primerIncendio = zona.incendios[0];
            
            // Crear un polígono aproximado alrededor del punto (buffer de ~1km)
            const bufferDegrees = 0.01; // Aproximadamente 1km
            const lon = primerIncendio.lon;
            const lat = primerIncendio.lat;
            
            return {
                zone_name: zona.zone_name,
                risk_level: riskLevel,
                vegetation_type: 'pastizal/matorral', // Por defecto, ajustar según datos
                area_km2: zona.superficie_total / 100, // Convertir hectáreas a km²
                fire_frequency: numIncendios,
                last_fire_date: zona.temporadas.size > 0 ? 
                    new Date().toISOString().split('T')[0] : null,
                high_risk_months: [11, 12, 1, 2, 3], // Verano austral
                metadata: {
                    causas_principales: Array.from(zona.causas),
                    temporadas: Array.from(zona.temporadas),
                    num_incendios: numIncendios
                },
                // Crear un polígono cuadrado alrededor del punto central
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [lon - bufferDegrees, lat - bufferDegrees],
                        [lon + bufferDegrees, lat - bufferDegrees],
                        [lon + bufferDegrees, lat + bufferDegrees],
                        [lon - bufferDegrees, lat + bufferDegrees],
                        [lon - bufferDegrees, lat - bufferDegrees] // Cerrar el polígono
                    ]]
                }
            };
        });
        
        console.log(`✓ ${resultado.fire_risk_zones.length} zonas de riesgo de incendio creadas`);
    }

    // ============================================================================
    // ADAPTAR CLIMA → weather_events
    // ============================================================================
    if (datos.clima_extremo && Object.keys(datos.clima_extremo).length > 0) {
        console.log(`\n▶ Procesando datos climáticos...`);
        
        const clima = datos.clima_extremo;
        
        // Determinar si el evento es extremo
        let severity = 'low';
        let eventType = 'normal';
        
        // Detectar precipitación extrema
        if (clima.precipitacion_mm && clima.precipitacion_mm > 50) {
            severity = 'extreme';
            eventType = 'storm';
        } else if (clima.precipitacion_mm && clima.precipitacion_mm > 20) {
            severity = 'high';
            eventType = 'storm';
        } else if (clima.viento && clima.viento > 60) {
            severity = 'high';
            eventType = 'wind';
        } else if (clima.viento && clima.viento > 40) {
            severity = 'medium';
            eventType = 'wind';
        } else if (clima.temperatura && (clima.temperatura > 35 || clima.temperatura < 0)) {
            severity = 'medium';
            eventType = clima.temperatura > 35 ? 'heatwave' : 'cold';
        }
        
        // Solo crear evento si hay condiciones relevantes
        if (eventType !== 'normal' || severity !== 'low') {
            resultado.weather_events.push({
                event_type: eventType,
                severity: severity,
                event_date: clima.timestamp ? 
                    new Date(clima.timestamp).toISOString().split('T')[0] : 
                    new Date().toISOString().split('T')[0],
                duration_hours: 24, // Por defecto 24 horas
                max_wind_speed: clima.viento || null,
                precipitation_mm: clima.precipitacion_mm || null,
                temperature_c: clima.temperatura || null,
                description: clima.descripcion || 'Evento climático registrado',
                infrastructure_damage: severity === 'extreme' ? 'moderate' : 
                                       severity === 'high' ? 'minor' : 'none',
                // Crear polígono cuadrado alrededor de Concepción (~10km)
                geometry: {
                    type: 'Polygon',
                    coordinates: [[
                        [-73.10, -36.87],
                        [-73.00, -36.87],
                        [-73.00, -36.77],
                        [-73.10, -36.77],
                        [-73.10, -36.87]
                    ]]
                }
            });
            
            console.log(`✓ 1 evento climático adaptado (${eventType}, severidad: ${severity})`);
        } else {
            console.log(`ℹ️  Condiciones climáticas normales, no se crea evento`);
        }
    }

    // Guardar datos adaptados
    const salidaPath = path.join(__dirname, 'amenazas_para_supabase.json');
    await fs.writeFile(
        salidaPath,
        JSON.stringify(resultado, null, 2),
        'utf-8'
    );

    console.log(`\n✅ Datos adaptados guardados en: amenazas_para_supabase.json`);
    console.log(`\nResumen:`);
    console.log(`  - Sismos (earthquakes): ${resultado.earthquakes.length}`);
    console.log(`  - Zonas de riesgo de incendio (fire_risk_zones): ${resultado.fire_risk_zones.length}`);
    console.log(`  - Eventos climáticos (weather_events): ${resultado.weather_events.length}`);

    return resultado;
}

// Ejecutar si se llama directamente
if (require.main === module) {
    adaptarDatosAmenazas().catch(console.error);
}

module.exports = { adaptarDatosAmenazas };
